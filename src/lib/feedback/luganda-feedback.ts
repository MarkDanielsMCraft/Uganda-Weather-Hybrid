import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { getRedisClient, redisGetJson, redisSadd, redisSet, redisSmembers } from "@/lib/cache/redis";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import type { LugandaFeedbackCategory, LugandaFeedbackInput } from "@/lib/validation/schemas";

/**
 * Server-only feedback persistence and Resend email delivery.
 * Recipient and sender addresses are read strictly from server environment variables.
 */
const RESEND_TIMEOUT_MS = 5_000;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 5_000;
const FEEDBACK_TTL_SECONDS = 90 * 24 * 60 * 60;
/** Server memory only keeps the newest reports, so a flood cannot fill it. */
export const MAX_MEMORY_FEEDBACK_REPORTS = 500;
const FEEDBACK_INDEX_KEY = "uw:feedback:luganda:ids";

export interface LugandaFeedbackRecord {
  id: string;
  category: LugandaFeedbackCategory;
  currentText?: string;
  suggestedText?: string;
  details: string;
  pageOrSection?: string;
  hasContactEmail: boolean;
  createdAt: string;
}

interface StoredLugandaFeedback {
  record: LugandaFeedbackRecord;
  contactEmail?: string;
}

function sanitizeLogToken(value: string): string {
  return value.replace(/[^\w:.\-]/g, "_").slice(0, 80);
}

export function logBlockedFeedbackAction(action: string, code: string, id = "none") {
  console.warn(
    `[luganda-feedback] action blocked action=${sanitizeLogToken(action)} code=${sanitizeLogToken(code)} id=${sanitizeLogToken(id)} by=anonymous`,
  );
}

function logFailedFeedbackAction(action: string, id: string, error: unknown) {
  const safeAction = sanitizeLogToken(action);
  const safeId = sanitizeLogToken(id);
  const statusMsg = error instanceof Error ? sanitizeLogToken(error.message) : "unknown_error";
  console.error(
    `[luganda-feedback] action failed action=${safeAction} id=${safeId} by=anonymous:`,
    statusMsg,
  );
  Sentry.captureException(new Error(`Luganda feedback ${safeAction} failed: ${statusMsg}`), {
    tags: {
      component: "luganda-feedback",
      action: safeAction,
      id: safeId,
    },
  });
}

function memoryFeedbackStore(): Map<string, StoredLugandaFeedback> {
  const globalRef = globalThis as typeof globalThis & {
    __uwLugandaFeedbackStore?: Map<string, StoredLugandaFeedback>;
  };
  if (!globalRef.__uwLugandaFeedbackStore) {
    globalRef.__uwLugandaFeedbackStore = new Map();
  }
  return globalRef.__uwLugandaFeedbackStore;
}

export function resetLugandaFeedbackStoreForTests() {
  const globalRef = globalThis as typeof globalThis & {
    __uwLugandaFeedbackStore?: Map<string, StoredLugandaFeedback>;
  };
  globalRef.__uwLugandaFeedbackStore = new Map();
}

function feedbackItemKey(id: string) {
  return `uw:feedback:luganda:item:${id}`;
}

function resolveFeedbackRecipient(): string | null {
  return process.env.LUGANDA_FEEDBACK_TO_EMAIL?.trim() || null;
}

function resolveResendFrom(): string | null {
  return process.env.RESEND_FROM_EMAIL?.trim() || null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CATEGORY_LABELS: Record<LugandaFeedbackCategory, string> = {
  translation: "Translation / Meaning (Ekigambo oba amakulu)",
  grammar: "Grammar / Orthography (Ggulaama n'empandiika)",
  layout: "UI / Layout (Endabika y'olupapula)",
  other: "Other (Ekirala)",
};

function formatUtcTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function buildEmailBodies(entry: StoredLugandaFeedback): {
  subject: string;
  text: string;
  html: string;
} {
  const { record, contactEmail } = entry;
  const categoryLabel = CATEGORY_LABELS[record.category];
  const formattedTime = formatUtcTimestamp(record.createdAt);
  const subjectSnippet = (record.currentText || record.details).slice(0, 48).replace(/\s+/g, " ");
  const subject = `[Uganda Weather Luganda Beta] ${record.category.toUpperCase()}: ${subjectSnippet}`;
  const preheader = `${categoryLabel}${record.pageOrSection ? ` on ${record.pageOrSection}` : ""}: ${record.details.slice(0, 90).replace(/\s+/g, " ")}`;

  const textLines = [
    "Uganda Weather: Luganda Beta Feedback Report",
    `Report ID: ${record.id}`,
    `Submitted At: ${formattedTime}`,
    `Category: ${categoryLabel}`,
    record.pageOrSection ? `Page / District: ${record.pageOrSection}` : null,
    record.currentText ? `Current Text: ${record.currentText}` : null,
    record.suggestedText ? `Suggested Correction: ${record.suggestedText}` : null,
    contactEmail ? `Reporter Reply Email: ${contactEmail}` : "Reporter Reply Email: Not provided",
    "",
    "Details:",
    record.details,
  ].filter((line): line is string => line !== null);

  const metaRow = (label: string, valueHtml: string) =>
    `<tr>
      <td class="meta-label" style="padding:10px 0;border-bottom:1px solid #232938;color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.03em;width:124px;vertical-align:top;">${escapeHtml(label)}</td>
      <td class="meta-value" style="padding:10px 0 10px 12px;border-bottom:1px solid #232938;color:#f8fafc;font-size:13px;line-height:1.45;word-break:break-word;vertical-align:top;">${valueHtml}</td>
    </tr>`;

  const comparisonBlock =
    record.currentText || record.suggestedText
      ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid #232938;">
          ${
            record.currentText
              ? `<div style="margin-bottom:12px;">
                  <div style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">Current on screen</div>
                  <div style="margin:0;font-size:14px;line-height:1.5;color:#e2e8f0;word-break:break-word;">${escapeHtml(record.currentText)}</div>
                </div>`
              : ""
          }
          ${
            record.suggestedText
              ? `<div style="padding-left:12px;border-left:2px solid #0d903b;">
                  <div style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#4ade80;">Suggested Luganda</div>
                  <div style="margin:0;font-size:14px;line-height:1.5;color:#ffffff;font-weight:500;word-break:break-word;">${escapeHtml(record.suggestedText)}</div>
                </div>`
              : ""
          }
        </div>`
      : "";

  const replyValueHtml = contactEmail
    ? `<a href="mailto:${escapeHtml(contactEmail)}" style="color:#4ade80;text-decoration:none;font-weight:500;word-break:break-all;">${escapeHtml(contactEmail)}</a>`
    : `<span style="color:#64748b;">Not provided</span>`;

  const footerNote = contactEmail
    ? `Reply directly to this email to respond to <span style="color:#cbd5e1;word-break:break-all;">${escapeHtml(contactEmail)}</span>.`
    : "No reply email was provided by the reporter.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(subject)}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 12px 8px !important; }
        .email-pad { padding: 16px 16px !important; }
        .email-title { font-size: 18px !important; }
        .meta-label {
          display: block !important;
          width: 100% !important;
          padding: 10px 0 2px 0 !important;
          border-bottom: none !important;
        }
        .meta-value {
          display: block !important;
          width: 100% !important;
          padding: 0 0 10px 0 !important;
        }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#0a0d14;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-shell" style="background:#0a0d14;padding:24px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#141925;border:1px solid #232938;border-top:4px solid #0d903b;border-radius:14px;overflow:hidden;">
            <tr>
              <td class="email-pad" style="padding:20px 22px 18px;border-bottom:1px solid #232938;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0d903b;">Uganda Weather · Luganda Beta</p>
                <h1 class="email-title" style="margin:8px 0 4px;font-size:20px;line-height:1.3;font-weight:700;color:#ffffff;">Luganda Issue &amp; Improvement Report</h1>
                <p style="margin:0;font-size:13px;line-height:1.45;color:#94a3b8;">Received ${escapeHtml(formattedTime)}</p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:18px 22px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                  ${metaRow("Report ID", `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#cbd5e1;word-break:break-all;">${escapeHtml(record.id)}</span>`)}
                  ${metaRow("Category", escapeHtml(categoryLabel))}
                  ${record.pageOrSection ? metaRow("Page / District", escapeHtml(record.pageOrSection)) : ""}
                  ${metaRow("Reply Email", replyValueHtml)}
                </table>
                ${comparisonBlock}
                <div style="margin-top:16px;padding-top:14px;border-top:1px solid #232938;">
                  <div style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#94a3b8;">Issue Details</div>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#f1f5f9;white-space:pre-wrap;word-break:break-word;">${escapeHtml(record.details)}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:14px 22px;border-top:1px solid #232938;font-size:12px;line-height:1.5;color:#64748b;">
                ${footerNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

async function sendEmailViaResend(entry: StoredLugandaFeedback): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = resolveFeedbackRecipient();
  const from = resolveResendFrom();
  if (!apiKey || !to || !from) return false;
  const { subject, text, html } = buildEmailBodies(entry);

  try {
    const response = await fetchWithTimeout(
      (signal) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [to],
            ...(entry.contactEmail ? { reply_to: entry.contactEmail } : {}),
            subject,
            text,
            html,
          }),
          cache: "no-store",
          signal,
        }),
      RESEND_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`resend_http_${response.status}`);
    }
    return true;
  } catch (error) {
    logFailedFeedbackAction("send_email", entry.record.id, error);
    return false;
  }
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string,
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  // When TURNSTILE_SECRET_KEY is not configured in the environment, skip verification
  if (!secretKey) return true;

  if (!token || token.trim().length === 0) {
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", token.trim());
    if (remoteIp && remoteIp !== "unknown") {
      body.set("remoteip", remoteIp);
    }

    const response = await fetchWithTimeout(
      (signal) =>
        fetch(TURNSTILE_VERIFY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
          cache: "no-store",
          signal,
        }),
      TURNSTILE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`turnstile_http_${response.status}`);
    }

    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    logFailedFeedbackAction("verify_turnstile", "turnstile", error);
    return false;
  }
}

export async function submitLugandaFeedback(input: LugandaFeedbackInput): Promise<{
  accepted: boolean;
  reportId: string;
  persisted: boolean;
  emailed: boolean;
}> {
  const reportId = randomUUID();
  const now = new Date().toISOString();

  const record: LugandaFeedbackRecord = {
    id: reportId,
    category: input.category,
    ...(input.currentText ? { currentText: input.currentText } : {}),
    ...(input.suggestedText ? { suggestedText: input.suggestedText } : {}),
    details: input.details,
    ...(input.pageOrSection ? { pageOrSection: input.pageOrSection } : {}),
    hasContactEmail: Boolean(input.contactEmail),
    createdAt: now,
  };

  const entry: StoredLugandaFeedback = {
    record,
    ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
  };

  const memory = memoryFeedbackStore();
  while (memory.size >= MAX_MEMORY_FEEDBACK_REPORTS) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
  memory.set(reportId, entry);

  const persistPromise = (async (): Promise<boolean> => {
    if (!getRedisClient()) return false;
    try {
      await Promise.all([
        redisSet(feedbackItemKey(reportId), JSON.stringify(entry), FEEDBACK_TTL_SECONDS),
        redisSadd(FEEDBACK_INDEX_KEY, reportId),
      ]);
      return true;
    } catch (error) {
      logFailedFeedbackAction("persist_redis", reportId, error);
      return false;
    }
  })();

  const [persisted, emailed] = await Promise.all([
    persistPromise,
    sendEmailViaResend(entry),
  ]);

  return {
    accepted: true,
    reportId,
    persisted,
    emailed,
  };
}

export async function listStoredLugandaFeedbackForTests(): Promise<LugandaFeedbackRecord[]> {
  const map = new Map<string, LugandaFeedbackRecord>();
  for (const [id, item] of memoryFeedbackStore().entries()) {
    map.set(id, item.record);
  }
  if (getRedisClient()) {
    try {
      const ids = await redisSmembers(FEEDBACK_INDEX_KEY);
      for (const id of ids) {
        if (!map.has(id)) {
          const stored = await redisGetJson<StoredLugandaFeedback>(feedbackItemKey(id));
          if (stored?.record) map.set(id, stored.record);
        }
      }
    } catch {
      // Fallback to in-memory records
    }
  }
  return [...map.values()];
}
