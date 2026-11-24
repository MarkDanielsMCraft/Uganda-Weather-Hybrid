import { createHash } from "node:crypto";
import {
  getRedisClient,
  redisDel,
  redisGetJson,
  redisSadd,
  redisScard,
  redisSet,
  redisSmembers,
  redisSrem,
} from "@/lib/cache/redis";

export type PushPlatform = "ios" | "android";
export type PushLanguage = "en" | "lg";

export interface PushTokenRecord {
  tokenHash: string;
  platform: PushPlatform;
  districtSlug: string;
  language?: PushLanguage;
  registeredAt: string;
  updatedAt: string;
}

interface StoredPushToken {
  record: PushTokenRecord;
  token: string;
}

const TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const TOKEN_INDEX_KEY = "uw:push:tokens";
const DISTRICT_INDEX_KEY = "uw:push:districts";

type MemoryStore = {
  tokens: Map<string, StoredPushToken>;
  districtIndex: Map<string, Set<string>>;
};

function memoryStore(): MemoryStore {
  const globalRef = globalThis as typeof globalThis & {
    __uwPushStore?: Partial<MemoryStore> & { records?: Map<string, StoredPushToken> };
  };

  if (!globalRef.__uwPushStore?.tokens) {
    const legacyRecords = globalRef.__uwPushStore?.records;
    globalRef.__uwPushStore = {
      tokens: legacyRecords ?? new Map(),
      districtIndex: globalRef.__uwPushStore?.districtIndex ?? new Map(),
    };
  }

  return globalRef.__uwPushStore as MemoryStore;
}

/** Reset the in-memory push store (tests only). */
export function resetPushStoreForTests() {
  const globalRef = globalThis as typeof globalThis & { __uwPushStore?: Partial<MemoryStore> };
  globalRef.__uwPushStore = { tokens: new Map(), districtIndex: new Map() };
}

export function hashPushToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenKey(tokenHash: string) {
  return `uw:push:token:${tokenHash}`;
}

function districtKey(districtSlug: string) {
  return `uw:push:district:${districtSlug}`;
}

/** Drop a district from the district index once its last token is gone,
    so listDistrictSlugsWithPushTokens doesn't keep scanning it forever. */
async function pruneDistrictIndexIfEmpty(districtSlug: string) {
  const remaining = await redisScard(districtKey(districtSlug));
  if (remaining === 0) {
    await redisSrem(DISTRICT_INDEX_KEY, districtSlug);
  }
}

function upsertMemory(entry: StoredPushToken) {
  const store = memoryStore();
  const previous = store.tokens.get(entry.record.tokenHash);
  if (previous && previous.record.districtSlug !== entry.record.districtSlug) {
    store.districtIndex.get(previous.record.districtSlug)?.delete(entry.record.tokenHash);
  }

  store.tokens.set(entry.record.tokenHash, entry);
  const districtSet = store.districtIndex.get(entry.record.districtSlug) ?? new Set<string>();
  districtSet.add(entry.record.tokenHash);
  store.districtIndex.set(entry.record.districtSlug, districtSet);
}

function removeMemory(tokenHash: string) {
  const store = memoryStore();
  const existing = store.tokens.get(tokenHash);
  if (!existing) return false;

  store.tokens.delete(tokenHash);
  store.districtIndex.get(existing.record.districtSlug)?.delete(tokenHash);
  return true;
}

export async function savePushToken(input: {
  token: string;
  platform: PushPlatform;
  districtSlug: string;
  language?: PushLanguage;
}): Promise<{ persisted: boolean; record: PushTokenRecord }> {
  const tokenHash = hashPushToken(input.token);
  const now = new Date().toISOString();
  const previous = memoryStore().tokens.get(tokenHash)?.record;
  const record: PushTokenRecord = {
    tokenHash,
    platform: input.platform,
    districtSlug: input.districtSlug,
    language: input.language ?? previous?.language ?? "en",
    registeredAt: previous?.registeredAt ?? now,
    updatedAt: now,
  };

  const entry: StoredPushToken = { record, token: input.token };
  upsertMemory(entry);

  if (!getRedisClient()) {
    return { persisted: false, record };
  }

  try {
    const writes: Promise<void>[] = [
      redisSet(tokenKey(tokenHash), JSON.stringify(entry), TOKEN_TTL_SECONDS),
      redisSadd(TOKEN_INDEX_KEY, tokenHash),
      redisSadd(districtKey(input.districtSlug), tokenHash),
      redisSadd(DISTRICT_INDEX_KEY, input.districtSlug),
    ];

    if (previous && previous.districtSlug !== input.districtSlug) {
      writes.push(redisSrem(districtKey(previous.districtSlug), tokenHash));
    }

    await Promise.all(writes);

    if (previous && previous.districtSlug !== input.districtSlug) {
      await pruneDistrictIndexIfEmpty(previous.districtSlug);
    }

    return { persisted: true, record };
  } catch (error) {
    console.error("Push token Redis save failed:", error);
    return { persisted: false, record };
  }
}

export async function removePushToken(token: string): Promise<{ removed: boolean; persisted: boolean }> {
  const tokenHash = hashPushToken(token);
  const previous = memoryStore().tokens.get(tokenHash)?.record;
  const removedFromMemory = removeMemory(tokenHash);

  if (!getRedisClient()) {
    return { removed: removedFromMemory, persisted: false };
  }

  try {
    const deletes: Promise<void>[] = [
      redisDel(tokenKey(tokenHash)),
      redisSrem(TOKEN_INDEX_KEY, tokenHash),
    ];
    if (previous) {
      deletes.push(redisSrem(districtKey(previous.districtSlug), tokenHash));
    }
    await Promise.all(deletes);

    if (previous) {
      await pruneDistrictIndexIfEmpty(previous.districtSlug);
    }

    return { removed: removedFromMemory || Boolean(previous), persisted: true };
  } catch (error) {
    console.error("Push token Redis delete failed:", error);
    return { removed: removedFromMemory, persisted: false };
  }
}

/** Far more than the real number of phones this app will reach, but low
    enough that a script sending made up tokens cannot grow the store, or the
    storm alert job that reads it, without end. */
export const MAX_STORED_PUSH_TOKENS = 100_000;

export async function isPushStoreFull(token: string): Promise<boolean> {
  const tokenHash = hashPushToken(token);
  if (await readStoredToken(tokenHash)) return false;
  const count = getRedisClient()
    ? await redisScard(TOKEN_INDEX_KEY)
    : memoryStore().tokens.size;
  return count >= MAX_STORED_PUSH_TOKENS;
}

async function readStoredToken(tokenHash: string): Promise<StoredPushToken | null> {
  const fromMemory = memoryStore().tokens.get(tokenHash);
  if (fromMemory) return fromMemory;

  if (!getRedisClient()) return null;

  return redisGetJson<StoredPushToken>(tokenKey(tokenHash));
}

export async function listPushTokensForDistrict(districtSlug: string): Promise<StoredPushToken[]> {
  const store = memoryStore();
  const hashes = new Set<string>();

  const memoryHashes = store.districtIndex.get(districtSlug);
  if (memoryHashes) {
    for (const hash of memoryHashes) hashes.add(hash);
  }

  if (getRedisClient()) {
    try {
      for (const hash of await redisSmembers(districtKey(districtSlug))) {
        hashes.add(hash);
      }
    } catch (error) {
      console.error("Push token district index read failed:", error);
    }
  }

  const tokens: StoredPushToken[] = [];
  for (const hash of hashes) {
    const entry = await readStoredToken(hash);
    if (entry && entry.record.districtSlug === districtSlug) {
      tokens.push(entry);
    }
  }

  return tokens;
}

export async function listDistrictSlugsWithPushTokens(): Promise<string[]> {
  const slugs = new Set<string>();
  const store = memoryStore();

  for (const [districtSlug, hashes] of store.districtIndex.entries()) {
    if (hashes.size > 0) slugs.add(districtSlug);
  }

  // The in-memory index only reflects tokens registered on *this*
  // instance. On serverless (each cron invocation can be a fresh
  // instance with an empty memory store), Redis is the only place that
  // reliably has the full picture, so it has to be consulted too rather
  // than treated as a write-behind cache nothing ever reads back.
  if (getRedisClient()) {
    try {
      for (const slug of await redisSmembers(DISTRICT_INDEX_KEY)) {
        slugs.add(slug);
      }
    } catch (error) {
      console.error("Push district index read failed:", error);
    }
  }

  return [...slugs];
}
