import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVoiceCacheForTests,
  getCachedVoiceClip,
  setCachedVoiceClip,
} from "@/lib/voice/voice-cache";

describe("voice-cache (memory + shared Redis)", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    clearVoiceCacheForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearVoiceCacheForTests();
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("reads from shared Redis on cold memory miss and hydrates local memory", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis-test.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-test";

    const redisStore = new Map<string, string>();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const cmd = JSON.parse(String(init?.body ?? "[]")) as string[];
      if (cmd[0] === "SET") {
        redisStore.set(cmd[1]!, cmd[2]!);
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }
      if (cmd[0] === "GET") {
        return new Response(
          JSON.stringify({ result: redisStore.get(cmd[1]!) ?? null }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ result: null }), { status: 200 });
    });

    const sample = {
      audio: new Uint8Array([11, 22, 33, 44]).buffer,
      contentType: "audio/mpeg",
    };

    await setCachedVoiceClip("kampala-lg-1", sample, 1_800_000);
    expect(redisStore.has("ug:voice:clip:v2:kampala-lg-1")).toBe(true);

    // Simulate a cold serverless instance by clearing L1 memory
    clearVoiceCacheForTests();

    const restored = await getCachedVoiceClip("kampala-lg-1");
    expect(restored).not.toBeNull();
    expect(restored?.contentType).toBe("audio/mpeg");
    expect(Array.from(new Uint8Array(restored!.audio))).toEqual([11, 22, 33, 44]);

    // Subsequent call hits L1 memory without calling Redis again
    const callsAfterColdRead = fetchSpy.mock.calls.length;
    const hotHit = await getCachedVoiceClip("kampala-lg-1");
    expect(hotHit).not.toBeNull();
    expect(fetchSpy.mock.calls.length).toBe(callsAfterColdRead);
  });

  it("rejects untrusted content types in Redis and degrades cleanly on network failure", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis-test.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-test";

    vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ result: null }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: JSON.stringify({
              contentType: "text/html",
              base64: Buffer.from("<script>alert(1)</script>").toString("base64"),
            }),
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: JSON.stringify({
              contentType: "audio/wav;\r\nrate=12000",
              base64: Buffer.from([1, 2, 3, 4]).toString("base64"),
            }),
          }),
          { status: 200 },
        ),
      )
      .mockRejectedValueOnce(new Error("network down"));

    expect(await getCachedVoiceClip("bad-mime")).toBeNull();
    expect(await getCachedVoiceClip("crlf-mime")).toBeNull();
    expect(await getCachedVoiceClip("offline-redis")).toBeNull();

    // Oversized clips (> 2 MB default VOICE_REDIS_MAX_AUDIO_BYTES) are skipped in both memory and Redis
    const oversized = {
      audio: new ArrayBuffer(2 * 1024 * 1024 + 1024),
      contentType: "audio/wav",
    };
    await setCachedVoiceClip("too-large", oversized, 1_800_000);
    expect(await getCachedVoiceClip("too-large")).toBeNull();
  });
});
