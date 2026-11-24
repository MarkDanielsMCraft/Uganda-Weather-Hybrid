import { createHmac } from "node:crypto";
import { ogSignedText, readOgImageSecret } from "@/lib/seo/og-text";

/** Only text the app itself signs is drawn on the branded share image, so
    nobody can make a real looking Uganda Weather card that says something
    the app never said. Returns null when no secret is set. */
export function signOgText(title: string, subtitle: string): string | null {
  const secret = readOgImageSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(ogSignedText(title, subtitle)).digest("hex");
}
