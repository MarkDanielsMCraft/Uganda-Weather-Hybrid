import { createSign } from "node:crypto";
import { connect, constants, type ClientHttp2Session } from "node:http2";

import type { StormAlertPayload } from "./dispatch";

const APNS_TIMEOUT_MS = 5_000;
const TOKEN_REFRESH_SECONDS = 45 * 60;
const APNS_PRODUCTION_HOST = "https://api.push.apple.com";
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com";
const APNS_BAD_DEVICE_TOKEN_REASON = "BadDeviceToken";

interface CachedProviderToken {
  value: string;
  expiresAt: number;
}

interface ApnsResponse {
  success: boolean;
  reason?: string;
}

let cachedProviderToken: CachedProviderToken | null = null;

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function resetCachedApnsTokenForTests(): void {
  cachedProviderToken = null;
}

export function getApnsProviderToken(): string | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  let privateKey = process.env.APNS_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedProviderToken && cachedProviderToken.expiresAt > now + 60) {
    return cachedProviderToken.value;
  }

  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  const header = encodeBase64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = encodeBase64Url(JSON.stringify({ iss: teamId, iat: now }));
  const unsignedToken = `${header}.${claims}`;
  const signer = createSign("SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  const token = `${unsignedToken}.${encodeBase64Url(signature)}`;

  cachedProviderToken = {
    value: token,
    expiresAt: now + TOKEN_REFRESH_SECONDS,
  };

  return token;
}

function connectToApns(url: string): Promise<ClientHttp2Session> {
  return new Promise((resolve, reject) => {
    const session = connect(url);
    const timeout = setTimeout(() => {
      session.destroy();
      reject(new Error("Push provider connection timed out"));
    }, APNS_TIMEOUT_MS);

    const onConnect = () => {
      clearTimeout(timeout);
      session.off("error", onError);
      resolve(session);
    };
    const onError = (error: Error) => {
      clearTimeout(timeout);
      session.destroy();
      reject(error);
    };

    session.once("connect", onConnect);
    session.once("error", onError);
  });
}

function sendApnsRequest(
  session: ClientHttp2Session,
  token: string,
  providerToken: string,
  topic: string,
  payload: StormAlertPayload,
): Promise<ApnsResponse> {
  return new Promise((resolve) => {
    let settled = false;
    let statusCode: number | undefined;
    let responseBody = "";
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(token)}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      let reason: string | undefined;
      try {
        reason = JSON.parse(responseBody).reason;
      } catch {
        reason = undefined;
      }
      resolve({ success, reason });
    };

    request.setTimeout(APNS_TIMEOUT_MS, () => {
      request.close(constants.NGHTTP2_CANCEL);
      finish(false);
    });
    request.on("response", (headers) => {
      statusCode = Number(headers[":status"]);
    });
    request.on("data", (chunk: Buffer) => {
      if (responseBody.length < 4096) responseBody += chunk.toString("utf8");
    });
    request.once("end", () => finish(statusCode === 200));
    request.once("error", () => finish(false));
    request.once("aborted", () => finish(false));
    request.end(
      JSON.stringify({
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
        },
        district: payload.districtSlug,
        route: payload.route ?? "/alerts",
      }),
    );
  });
}

async function sendToHost(
  url: string,
  tokens: string[],
  providerToken: string,
  topic: string,
  payload: StormAlertPayload,
): Promise<ApnsResponse[]> {
  let session: ClientHttp2Session;
  try {
    session = await connectToApns(url);
  } catch (error) {
    console.error("[push:apns] Could not connect to the push provider:", error);
    return tokens.map(() => ({ success: false }));
  }

  try {
    return await Promise.all(
      tokens.map((token) =>
        sendApnsRequest(session, token, providerToken, topic, payload).catch(() => ({
          success: false,
        })),
      ),
    );
  } finally {
    session.close();
  }
}

export async function sendApnsNotifications(
  tokens: string[],
  payload: StormAlertPayload,
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const providerToken = getApnsProviderToken();
  const topic = process.env.APNS_TOPIC;
  if (!providerToken || !topic) {
    console.error("APNs delivery is not configured. Set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, and APNS_TOPIC.");
    return { sent: 0, failed: tokens.length };
  }

  const results = await sendToHost(
    APNS_PRODUCTION_HOST,
    tokens,
    providerToken,
    topic,
    payload,
  );
  const fallbackIndexes = results.flatMap((result, index) =>
    result.reason === APNS_BAD_DEVICE_TOKEN_REASON ? [index] : [],
  );

  if (fallbackIndexes.length > 0) {
    const fallbackTokens = fallbackIndexes.map((index) => tokens[index]!);
    const fallbackResults = await sendToHost(
      APNS_SANDBOX_HOST,
      fallbackTokens,
      providerToken,
      topic,
      payload,
    );
    fallbackIndexes.forEach((originalIndex, fallbackIndex) => {
      results[originalIndex] = fallbackResults[fallbackIndex]!;
    });
  }

  const sent = results.filter((result) => result.success).length;
  return { sent, failed: tokens.length - sent };
}
