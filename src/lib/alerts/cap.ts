import type { AlertSeverity, District, WeatherAlert } from "@/types/weather";
import { mapAlertSeverity } from "./normalize";

const CAP_NS = "urn:oasis:names:tc:emergency:cap:1.2";

export const DEFAULT_UNMA_CAP_FEED =
  "https://cap-sources.s3.amazonaws.com/ug-dms-en/rss.xml";

interface CapInfoBlock {
  headline: string;
  description: string;
  severity: string;
  areas: string[];
  effective?: string;
  expires?: string;
  event?: string;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(block: string, tag: string) {
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
  const match = block.match(pattern);
  return match ? decodeXml(match[1]) : "";
}

function extractAllTags(block: string, tag: string) {
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "gi");
  const values: string[] = [];
  let match = pattern.exec(block);
  while (match) {
    values.push(decodeXml(match[1]));
    match = pattern.exec(block);
  }
  return values;
}

function parseCapInfoBlocks(capXml: string): CapInfoBlock[] {
  const infoBlocks = capXml.match(/<(?:[\w-]+:)?info[\s\S]*?<\/(?:[\w-]+:)?info>/gi) ?? [];
  if (infoBlocks.length === 0) return [];

  return infoBlocks.map((info) => ({
    headline: extractTag(info, "headline") || extractTag(info, "event"),
    description: extractTag(info, "description") || extractTag(info, "instruction"),
    severity: extractTag(info, "severity"),
    areas: extractAllTags(info, "areaDesc"),
    effective: extractTag(info, "effective") || extractTag(capXml, "sent"),
    expires: extractTag(info, "expires"),
    event: extractTag(info, "event"),
  }));
}

function parseCapAlertXml(capXml: string, fallbackTitle: string) {
  const identifier = extractTag(capXml, "identifier");
  const sent = extractTag(capXml, "sent");
  const status = extractTag(capXml, "status").toLowerCase();
  if (status && status !== "actual" && status !== "test") return [];

  const infoBlocks = parseCapInfoBlocks(capXml);
  if (infoBlocks.length === 0) {
    const headline = fallbackTitle.trim();
    if (!headline) return [];
    return [
      {
        id: identifier || headline,
        headline,
        description: extractTag(capXml, "description") || headline,
        severity: "advisory" as AlertSeverity,
        areas: [] as string[],
        issuedAt: sent || new Date().toISOString(),
        expiresAt: undefined as string | undefined,
      },
    ];
  }

  return infoBlocks.map((info, index) => ({
    id: identifier ? `${identifier}-${index}` : `${info.headline}-${index}`,
    headline: info.headline || info.event || fallbackTitle || "Weather Alert",
    description: info.description || info.headline || "Monitor local conditions.",
    severity: mapAlertSeverity(info.severity || "advisory"),
    areas: info.areas,
    issuedAt: info.effective || sent || new Date().toISOString(),
    expiresAt: info.expires,
  }));
}

export function parseCapRssFeed(xml: string) {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const alerts: Array<{
    id: string;
    headline: string;
    description: string;
    severity: AlertSeverity;
    areas: string[];
    issuedAt: string;
    expiresAt?: string;
  }> = [];

  for (const item of items) {
    const title = extractTag(item, "title");
    const capXml =
      item.match(/<(?:[\w-]+:)?alert[\s\S]*?<\/(?:[\w-]+:)?alert>/i)?.[0] ??
      (item.includes(CAP_NS) ? item : "");

    const parsed = parseCapAlertXml(capXml || item, title);
    alerts.push(...parsed);
  }

  return alerts;
}

export function capAlertAppliesToDistrict(areas: string[], district: District) {
  if (areas.length === 0) return true;

  const districtNames = [
    district.name.toLowerCase(),
    district.name.replace(/\s+City$/i, "").toLowerCase(),
    district.slug.replace(/-/g, " "),
  ];

  for (const area of areas) {
    const normalized = area.toLowerCase();
    if (
      normalized.includes("uganda") ||
      normalized.includes("country") ||
      normalized.includes("all districts") ||
      normalized.includes("nationwide")
    ) {
      return true;
    }

    for (const name of districtNames) {
      if (name.length >= 3 && normalized.includes(name)) return true;
    }

    if (normalized.includes(district.region)) return true;
  }

  return false;
}

export function capAlertsToWeatherAlerts(
  parsed: ReturnType<typeof parseCapRssFeed>,
  district: District,
): WeatherAlert[] {
  return parsed
    .filter((alert) => capAlertAppliesToDistrict(alert.areas, district))
    .map((alert) => ({
      id: `unma-${district.slug}-${alert.id}`,
      title: alert.headline,
      description: alert.description,
      severity: alert.severity,
      source: "UNMA",
      issuedAt: alert.issuedAt,
      expiresAt: alert.expiresAt,
    }));
}
