import { z } from "zod";

export const districtSlugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9-]+$/);

export const districtQuerySchema = z.object({
  district: districtSlugSchema,
});

const coordNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().finite().min(min).max(max),
  );

/** Real Ugandan place names and labels never carry phone numbers, links,
    emails, or markup. Refusing them keeps planted scam text out of the
    forecast screen and out of the AI advisor's instructions. */
const PLACE_TEXT_BLOCKED = /https?:|www\.|@|[<>{}\[\]`\\]|[\u0000-\u001f\u007f]/i;
const MAX_DIGITS_IN_PLACE_TEXT = 4;

export function isSafePlaceText(value: string): boolean {
  if (PLACE_TEXT_BLOCKED.test(value)) return false;
  const digits = value.match(/\p{Nd}/gu)?.length ?? 0;
  return digits <= MAX_DIGITS_IN_PLACE_TEXT;
}

const placeTextSchema = (min: number, max: number) =>
  z.string().min(min).max(max).refine(isSafePlaceText, "Place text is not allowed");

export const placeWeatherQuerySchema = z.object({
  place: z.string().min(2).max(120),
  name: placeTextSchema(2, 120),
  lat: coordNumber(-4, 5),
  lon: coordNumber(29, 36),
  label: placeTextSchema(0, 160).optional(),
  parent: districtSlugSchema.optional(),
});

export const forecastQuerySchema = z.object({
  district: districtSlugSchema.optional(),
  place: z.string().min(2).max(120).optional(),
  name: z.string().min(2).max(120).optional(),
  lat: coordNumber(-4, 5).optional(),
  lon: coordNumber(29, 36).optional(),
  label: z.string().max(160).optional(),
  parent: districtSlugSchema.optional(),
  days: z.coerce.number().int().min(1).max(14).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
});

export const reverseLocationQuerySchema = z.object({
  lat: coordNumber(-4, 5),
  lon: coordNumber(29, 36),
});

export const regionQuerySchema = z.object({
  region: z.enum(["central", "eastern", "northern", "western"]).optional(),
});

/** Android (FCM) tokens use letters, digits, colons, dashes, and
    underscores. iPhone (APNs) tokens are hex. Anything else is not a token. */
const pushTokenSchema = z.string().min(16).max(512).regex(/^[A-Za-z0-9_:.-]+$/);

export const pushRegisterSchema = z.object({
  token: pushTokenSchema,
  platform: z.enum(["ios", "android", "web"]),
  districtSlug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  language: z.enum(["en", "lg"]).optional().default("en"),
});

export const cronPrefetchQuerySchema = z.object({
  mode: z.enum(["priority", "all"]).default("priority"),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  concurrency: z.coerce.number().int().min(1).max(10).default(3),
});

export const pushUnregisterSchema = z.object({
  token: pushTokenSchema,
});

export const pushDispatchSchema = z.object({
  districtSlug: districtSlugSchema,
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(240),
  route: z.string().max(120).optional(),
  dryRun: z.boolean().optional(),
});

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const lugandaFeedbackCategorySchema = z.enum([
  "translation",
  "grammar",
  "layout",
  "other",
]);

export type LugandaFeedbackCategory = z.infer<typeof lugandaFeedbackCategorySchema>;

export const lugandaFeedbackSchema = z.object({
  category: lugandaFeedbackCategorySchema,
  currentText: optionalTrimmedString(300),
  suggestedText: optionalTrimmedString(300),
  details: z.string().trim().min(5).max(2000),
  pageOrSection: optionalTrimmedString(160),
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email().max(160).optional(),
  ),
  turnstileToken: optionalTrimmedString(4096),
  website: z.string().max(200).optional(),
});

export type LugandaFeedbackInput = z.infer<typeof lugandaFeedbackSchema>;
