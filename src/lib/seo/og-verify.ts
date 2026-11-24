import { ogSignedText, readOgImageSecret } from "@/lib/seo/og-text";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** Runs on the Edge, so it uses Web Crypto. The comparison takes the same
    time whatever the signature, so it cannot be guessed one letter at a time. */
export async function isSignedOgText(
  title: string,
  subtitle: string,
  signature: string | null,
): Promise<boolean> {
  const secret = readOgImageSecret();
  if (!secret || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ogSignedText(title, subtitle))),
  );
  return sameText(expected, signature);
}
