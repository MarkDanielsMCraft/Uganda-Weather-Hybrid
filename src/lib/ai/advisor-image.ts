import { getAllDistricts } from "@/lib/districts";
import { distanceKm } from "@/lib/geo/distance";
import { isWithinUganda } from "@/lib/places/uganda-bounds";

export interface PhotoLocationMatch {
  lat: number;
  lon: number;
  withinUganda: boolean;
  nearestDistrictSlug?: string;
  nearestDistrictName?: string;
  distanceToActiveKm?: number;
  matchesActiveDistrict: boolean;
}

export interface AdvisorImageMetadata {
  capturedAtIso: string | null;
  timestampSource: "exif" | "file" | "unknown";
  ageMinutes: number | null;
  isStale: boolean;
  location: PhotoLocationMatch | null;
  /** True once the image has been re-encoded via canvas, stripping all EXIF GPS/device headers. */
  exifStripped?: boolean;
}

export interface AdvisorImageAttachment {
  base64: string;
  mimeType: "image/jpeg";
  previewUrl: string;
  metadata: AdvisorImageMetadata;
}

const MAX_DIMENSION_PX = 768;
const JPEG_QUALITY = 0.72;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const STALE_PHOTO_MINUTES = 180;
const SAME_AREA_RADIUS_KM = 35;
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;
const HEIC_EXTENSION_RE = /\.(heic|heif)$/i;

export function isHeicBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);
  const ftyp = readAscii(view, 4, 4);
  if (ftyp !== "ftyp") return false;
  const brand = readAscii(view, 8, 4).toLowerCase();
  return brand === "heic" || brand === "heix" || brand === "hevc" || brand === "mif1" || brand === "msf1";
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  const end = Math.min(view.byteLength, offset + length);
  for (let i = offset; i < end; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset + 8 > view.byteLength) return NaN;
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den === 0 ? NaN : num / den;
}

function parseExifDateString(raw: string): Date | null {
  // Standard EXIF format: "YYYY:MM:DD HH:MM:SS"
  const match = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface ParsedExifInfo {
  capturedAt: Date | null;
  gps: { lat: number; lon: number } | null;
}

/**
 * Lightweight, zero-dependency JPEG EXIF reader for DateTimeOriginal and GPS coordinates.
 */
export function parseJpegExif(buffer: ArrayBuffer): ParsedExifInfo {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
    return { capturedAt: null, gps: null };
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) break;

    if (marker === 0xe1 && readAscii(view, offset + 4, 6) === "Exif") {
      const tiffStart = offset + 10;
      if (tiffStart + 8 > view.byteLength) break;
      const byteOrder = readAscii(view, tiffStart, 2);
      const littleEndian = byteOrder === "II";
      if (!littleEndian && byteOrder !== "MM") break;

      const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifd0 = tiffStart + firstIfdOffset;

      let exifIfdOffset: number | null = null;
      let gpsIfdOffset: number | null = null;
      let dateTimeFallback: Date | null = null;
      let dateTimeOriginal: Date | null = null;

      const walkIfd = (
        ifdStart: number,
        onTag: (tag: number, type: number, count: number, valueOffset: number) => void,
      ) => {
        if (ifdStart + 2 > view.byteLength) return;
        const count = view.getUint16(ifdStart, littleEndian);
        for (let i = 0; i < count; i += 1) {
          const entry = ifdStart + 2 + i * 12;
          if (entry + 12 > view.byteLength) break;
          const tag = view.getUint16(entry, littleEndian);
          const type = view.getUint16(entry + 2, littleEndian);
          const valCount = view.getUint32(entry + 4, littleEndian);
          const rawValOffset = entry + 8;
          onTag(tag, type, valCount, rawValOffset);
        }
      };

      const readStringTag = (valCount: number, rawValOffset: number): string => {
        if (valCount <= 4) {
          return readAscii(view, rawValOffset, valCount);
        }
        const ptr = tiffStart + view.getUint32(rawValOffset, littleEndian);
        return readAscii(view, ptr, valCount);
      };

      walkIfd(ifd0, (tag, _type, valCount, rawValOffset) => {
        if (tag === 0x0132) {
          dateTimeFallback = parseExifDateString(readStringTag(valCount, rawValOffset));
        } else if (tag === 0x8769) {
          exifIfdOffset = tiffStart + view.getUint32(rawValOffset, littleEndian);
        } else if (tag === 0x8825) {
          gpsIfdOffset = tiffStart + view.getUint32(rawValOffset, littleEndian);
        }
      });

      if (exifIfdOffset !== null) {
        walkIfd(exifIfdOffset, (tag, _type, valCount, rawValOffset) => {
          if (tag === 0x9003 || tag === 0x9004) {
            const parsed = parseExifDateString(readStringTag(valCount, rawValOffset));
            if (parsed && !dateTimeOriginal) {
              dateTimeOriginal = parsed;
            }
          }
        });
      }

      let gps: { lat: number; lon: number } | null = null;
      if (gpsIfdOffset !== null) {
        const gpsState: {
          latRef: string;
          lonRef: string;
          latDms: [number, number, number] | null;
          lonDms: [number, number, number] | null;
        } = { latRef: "", lonRef: "", latDms: null, lonDms: null };

        walkIfd(gpsIfdOffset, (tag, _type, valCount, rawValOffset) => {
          if (tag === 0x0001) {
            gpsState.latRef = readStringTag(valCount, rawValOffset).toUpperCase();
          } else if (tag === 0x0003) {
            gpsState.lonRef = readStringTag(valCount, rawValOffset).toUpperCase();
          } else if (tag === 0x0002 && valCount === 3) {
            const ptr = tiffStart + view.getUint32(rawValOffset, littleEndian);
            gpsState.latDms = [
              readRational(view, ptr, littleEndian),
              readRational(view, ptr + 8, littleEndian),
              readRational(view, ptr + 16, littleEndian),
            ];
          } else if (tag === 0x0004 && valCount === 3) {
            const ptr = tiffStart + view.getUint32(rawValOffset, littleEndian);
            gpsState.lonDms = [
              readRational(view, ptr, littleEndian),
              readRational(view, ptr + 8, littleEndian),
              readRational(view, ptr + 16, littleEndian),
            ];
          }
        });

        if (gpsState.latDms && gpsState.lonDms) {
          const [latD, latM, latS] = gpsState.latDms;
          const [lonD, lonM, lonS] = gpsState.lonDms;
          const rawLat = latD + latM / 60 + latS / 3600;
          const rawLon = lonD + lonM / 60 + lonS / 3600;
          if (Number.isFinite(rawLat) && Number.isFinite(rawLon)) {
            const lat = gpsState.latRef === "S" ? -rawLat : rawLat;
            const lon = gpsState.lonRef === "W" ? -rawLon : rawLon;
            if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
              gps = { lat, lon };
            }
          }
        }
      }

      return {
        capturedAt: dateTimeOriginal ?? dateTimeFallback,
        gps,
      };
    }

    offset += 2 + segmentLength;
  }

  return { capturedAt: null, gps: null };
}

export function hasExifApp1Marker(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
    return false;
  }
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) break;
    if (marker === 0xe1 && readAscii(view, offset + 4, 6) === "Exif") {
      return true;
    }
    offset += 2 + segmentLength;
  }
  return false;
}

export function evaluatePhotoMetadata(
  exif: ParsedExifInfo,
  fileLastModified: number | undefined,
  activeDistrict?: { slug: string; lat: number; lon: number },
  nowMs: number = Date.now(),
): AdvisorImageMetadata {
  let capturedAt: Date | null = exif.capturedAt;
  let timestampSource: "exif" | "file" | "unknown" = capturedAt ? "exif" : "unknown";

  if (!capturedAt && typeof fileLastModified === "number" && fileLastModified > 0) {
    const fallbackDate = new Date(fileLastModified);
    if (!Number.isNaN(fallbackDate.getTime())) {
      capturedAt = fallbackDate;
      timestampSource = "file";
    }
  }

  const ageMinutes = capturedAt
    ? Math.max(0, Math.round((nowMs - capturedAt.getTime()) / 60_000))
    : null;
  // Only mark as stale from camera EXIF capture time so a screenshot or
  // gallery file without EXIF is not falsely flagged from file modification dates.
  const isStale =
    timestampSource === "exif" && ageMinutes !== null && ageMinutes > STALE_PHOTO_MINUTES;

  let location: PhotoLocationMatch | null = null;
  if (exif.gps) {
    const { lat, lon } = exif.gps;
    const withinUganda = isWithinUganda(lat, lon);
    if (!withinUganda) {
      location = {
        lat,
        lon,
        withinUganda: false,
        matchesActiveDistrict: false,
      };
    } else {
      const districts = getAllDistricts();
      let nearest = districts[0];
      let bestKm = Number.POSITIVE_INFINITY;
      for (const d of districts) {
        const km = distanceKm({ lat, lon }, { lat: d.coordinates.lat, lon: d.coordinates.lon });
        if (km < bestKm) {
          bestKm = km;
          nearest = d;
        }
      }
      const distanceToActiveKm = activeDistrict
        ? Math.round(distanceKm({ lat, lon }, { lat: activeDistrict.lat, lon: activeDistrict.lon }))
        : undefined;
      const matchesActiveDistrict =
        !activeDistrict ||
        nearest?.slug === activeDistrict.slug ||
        (distanceToActiveKm !== undefined && distanceToActiveKm <= SAME_AREA_RADIUS_KM);

      location = {
        lat,
        lon,
        withinUganda: true,
        nearestDistrictSlug: nearest?.slug,
        nearestDistrictName: nearest?.name,
        distanceToActiveKm,
        matchesActiveDistrict,
      };
    }
  }

  return {
    capturedAtIso: capturedAt ? capturedAt.toISOString() : null,
    timestampSource,
    ageMinutes,
    isStale,
    location,
  };
}

/**
 * Extracts EXIF timestamp + GPS location metadata and compresses a camera or
 * gallery photo on-device to a 768px JPEG (~40-70 KB) for fast 3G upload.
 */
export async function compressImageForAdvisor(
  file: File,
  activeDistrict?: { slug: string; lat: number; lon: number },
): Promise<AdvisorImageAttachment> {
  const hasImageMime = file.type.startsWith("image/");
  const hasImageExt = IMAGE_EXTENSION_RE.test(file.name || "");
  if (!hasImageMime && !hasImageExt) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  let exif: ParsedExifInfo = { capturedAt: null, gps: null };
  let looksLikeHeic = HEIC_EXTENSION_RE.test(file.name || "") || /heic|heif/i.test(file.type || "");
  try {
    const rawBuffer = await file.arrayBuffer();
    if (isHeicBuffer(rawBuffer)) {
      looksLikeHeic = true;
    }
    exif = parseJpegExif(rawBuffer);
  } catch {
    exif = { capturedAt: null, gps: null };
  }

  const metadata = evaluatePhotoMetadata(exif, file.lastModified, activeDistrict);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error(looksLikeHeic ? "HEIC_NOT_SUPPORTED" : "IMAGE_DECODE_FAILED"));
      el.src = objectUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CANVAS_UNAVAILABLE");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
    if (!base64) {
      throw new Error("IMAGE_ENCODE_FAILED");
    }

    return {
      base64,
      mimeType: "image/jpeg",
      previewUrl: dataUrl,
      metadata: {
        ...metadata,
        exifStripped: true,
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
