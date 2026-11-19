import { describe, expect, it } from "vitest";
import { capAlertAppliesToDistrict, capAlertsToWeatherAlerts, parseCapRssFeed } from "./cap";
import { makeDistrict } from "@/lib/test-fixtures/weather-bundle";

describe("capAlertAppliesToDistrict", () => {
  const kampala = makeDistrict({ name: "Kampala", slug: "kampala", region: "central" });

  it("applies to every district when no areas are specified", () => {
    expect(capAlertAppliesToDistrict([], kampala)).toBe(true);
  });

  it("applies when the area is a nationwide phrase", () => {
    expect(capAlertAppliesToDistrict(["All districts of Uganda"], kampala)).toBe(true);
    expect(capAlertAppliesToDistrict(["Nationwide"], kampala)).toBe(true);
  });

  it("applies when the area names the district directly", () => {
    expect(capAlertAppliesToDistrict(["Kampala District"], kampala)).toBe(true);
  });

  it("applies when the area names the district's region", () => {
    expect(capAlertAppliesToDistrict(["Central region"], kampala)).toBe(true);
  });

  it("does not apply when the area is an unrelated district/region", () => {
    expect(capAlertAppliesToDistrict(["Gulu District"], kampala)).toBe(false);
    expect(capAlertAppliesToDistrict(["Northern region"], kampala)).toBe(false);
  });

  it("matches a City-suffixed name against its base district name", () => {
    const gulu = makeDistrict({ name: "Gulu City", slug: "gulu-city", region: "northern" });
    expect(capAlertAppliesToDistrict(["Gulu"], gulu)).toBe(true);
  });
});

describe("parseCapRssFeed", () => {
  it("parses a CAP alert item with multiple info blocks", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>Fallback title</title>
  <description><![CDATA[
  <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>UG-DMS-001</identifier>
    <sent>2026-01-01T08:00:00+03:00</sent>
    <status>Actual</status>
    <info>
      <event>Heavy Rain</event>
      <severity>Severe</severity>
      <areaDesc>Kampala District</areaDesc>
      <effective>2026-01-01T09:00:00+03:00</effective>
      <expires>2026-01-02T09:00:00+03:00</expires>
      <description>Heavy rain expected across Kampala.</description>
    </info>
  </alert>
  ]]></description>
</item>
</channel></rss>`;

    const parsed = parseCapRssFeed(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "UG-DMS-001-0",
      headline: "Heavy Rain",
      severity: "warning",
      areas: ["Kampala District"],
    });
  });

  it("parses a CAP alert item with XML namespaced tags (e.g. cap:info, cap:event)", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>Fallback title</title>
  <description><![CDATA[
  <cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
    <cap:identifier>UG-UNMA-009</cap:identifier>
    <cap:sent>2026-02-01T10:00:00+03:00</cap:sent>
    <cap:status>Actual</cap:status>
    <cap:info>
      <cap:event>Severe Lake Victoria Squall</cap:event>
      <cap:severity>Extreme</cap:severity>
      <cap:areaDesc>Kalangala District</cap:areaDesc>
      <cap:areaDesc>Entebbe</cap:areaDesc>
      <cap:effective>2026-02-01T11:00:00+03:00</cap:effective>
      <cap:expires>2026-02-01T18:00:00+03:00</cap:expires>
      <cap:description>Dangerous nocturnal wave heights and squalls approaching.</cap:description>
    </cap:info>
  </cap:alert>
  ]]></description>
</item>
</channel></rss>`;

    const parsed = parseCapRssFeed(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "UG-UNMA-009-0",
      headline: "Severe Lake Victoria Squall",
      severity: "extreme",
      areas: ["Kalangala District", "Entebbe"],
    });
  });

  it("skips alerts whose status is neither Actual nor Test", () => {
    const xml = `<item><description><![CDATA[
      <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
        <identifier>UG-DMS-002</identifier>
        <status>Exercise</status>
        <info><event>Drill</event><areaDesc>Kampala</areaDesc></info>
      </alert>
    ]]></description></item>`;
    expect(parseCapRssFeed(xml)).toHaveLength(0);
  });

  it("falls back to the RSS item title when there's no CAP <alert> block", () => {
    const xml = `<item><title>Plain UNMA bulletin</title><description>No CAP payload here</description></item>`;
    const parsed = parseCapRssFeed(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].headline).toBe("Plain UNMA bulletin");
  });

  it("returns nothing for an empty feed", () => {
    expect(parseCapRssFeed("<rss><channel></channel></rss>")).toEqual([]);
  });
});

describe("capAlertsToWeatherAlerts", () => {
  it("filters parsed alerts to only those applying to the district and prefixes ids", () => {
    const kampala = makeDistrict({ name: "Kampala", slug: "kampala", region: "central" });
    const parsed = [
      { id: "1", headline: "Kampala flood", description: "d", severity: "warning" as const, areas: ["Kampala"], issuedAt: "2026-01-01T00:00:00Z" },
      { id: "2", headline: "Gulu flood", description: "d", severity: "warning" as const, areas: ["Gulu"], issuedAt: "2026-01-01T00:00:00Z" },
    ];
    const result = capAlertsToWeatherAlerts(parsed, kampala);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("unma-kampala-1");
    expect(result[0].source).toBe("UNMA");
  });
});
