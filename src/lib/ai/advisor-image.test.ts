import { describe, expect, it } from "vitest";
import {
  evaluatePhotoMetadata,
  hasExifApp1Marker,
  isHeicBuffer,
  parseJpegExif,
} from "./advisor-image";

describe("advisor-image metadata and location verification", () => {
  it("flags outdated photos older than 3 hours as stale", () => {
    const now = Date.parse("2026-11-21T15:00:00Z");
    const oldShot = new Date("2026-11-20T10:00:00Z");
    const meta = evaluatePhotoMetadata(
      { capturedAt: oldShot, gps: null },
      undefined,
      { slug: "kampala", lat: 0.3476, lon: 32.5825 },
      now,
    );
    expect(meta.isStale).toBe(true);
    expect(meta.timestampSource).toBe("exif");
    expect(meta.ageMinutes).toBeGreaterThan(180);
  });

  it("detects when a photo GPS belongs to another Uganda district", () => {
    const now = Date.parse("2026-11-21T15:00:00Z");
    const freshShot = new Date("2026-11-21T14:50:00Z");
    // Jinja coordinates while active district is Mbale City
    const meta = evaluatePhotoMetadata(
      { capturedAt: freshShot, gps: { lat: 0.4244, lon: 33.2041 } },
      undefined,
      { slug: "mbale-city", lat: 1.0644, lon: 34.1794 },
      now,
    );
    expect(meta.isStale).toBe(false);
    expect(meta.location?.withinUganda).toBe(true);
    expect(meta.location?.matchesActiveDistrict).toBe(false);
    expect(meta.location?.nearestDistrictName?.toLowerCase()).toContain("jinja");
  });

  it("detects when a photo GPS was taken outside Uganda", () => {
    const now = Date.parse("2026-11-21T15:00:00Z");
    const meta = evaluatePhotoMetadata(
      { capturedAt: new Date(now - 5 * 60_000), gps: { lat: 51.5074, lon: -0.1278 } },
      undefined,
      { slug: "kampala", lat: 0.3476, lon: 32.5825 },
      now,
    );
    expect(meta.location?.withinUganda).toBe(false);
    expect(meta.location?.matchesActiveDistrict).toBe(false);
  });

  it("handles non-JPEG or stripped-EXIF buffers cleanly without throwing", () => {
    const result = parseJpegExif(new Uint8Array([1, 2, 3, 4]).buffer);
    expect(result).toEqual({ capturedAt: null, gps: null });
  });

  it("does not falsely flag a screenshot without EXIF as stale just from file modification date", () => {
    const now = Date.parse("2026-11-21T15:00:00Z");
    const oldFileMod = Date.parse("2026-11-18T10:00:00Z");
    const meta = evaluatePhotoMetadata({ capturedAt: null, gps: null }, oldFileMod, undefined, now);
    expect(meta.timestampSource).toBe("file");
    expect(meta.isStale).toBe(false);
  });

  it("detects ISO-BMFF HEIC ftyp headers accurately", () => {
    const heicBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x68, 0x65, 0x69, 0x63, // "heic"
    ]);
    expect(isHeicBuffer(heicBytes.buffer)).toBe(true);
    expect(isHeicBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer)).toBe(false);
  });

  it("detects EXIF APP1 markers on raw camera JPEGs and confirms stripped JPEGs have none", () => {
    const withExif = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe1, // APP1
      0x00, 0x08, // length = 8
      0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
      0xff, 0xd9, // EOI
    ]);
    const stripped = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe0, // APP0 JFIF
      0x00, 0x04, 0x00, 0x00,
      0xff, 0xd9, // EOI
    ]);
    expect(hasExifApp1Marker(withExif.buffer)).toBe(true);
    expect(hasExifApp1Marker(stripped.buffer)).toBe(false);
  });
});
