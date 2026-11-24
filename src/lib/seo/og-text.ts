/** What the share image signature covers. Kept free of any crypto import so
    the Node side that signs and the Edge side that checks share one format. */
export const OG_SIGNATURE_PARAM = "sig";

export function ogSignedText(title: string, subtitle: string): string {
  return `${title}\u0000${subtitle}`;
}

export function readOgImageSecret(): string | null {
  const secret = process.env.OG_IMAGE_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}
