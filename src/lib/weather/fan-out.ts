/**
 * Runs a fan out a few items at a time instead of all at once.
 *
 * The parks, mountains and chip strips ask for weather at ten to nineteen
 * places in one request. Firing all of them together is fine while the
 * primary provider answers, and falls apart the moment it does not: every
 * one of those lookups drops to the same fallback provider simultaneously,
 * and a keyless free tier meets a nineteen way burst with timeouts and rate
 * limiting. The route drops whatever failed, so the list silently shrinks —
 * observed as one park returned out of ten on a deployment with no primary
 * key, where the same code returned all ten with the primary available.
 *
 * A small window keeps the fallback usable as a fallback, which is the whole
 * point of having one. It costs a little latency on the happy path and saves
 * the list from collapsing on the unhappy one.
 */
export const FAN_OUT_CONCURRENCY = 4;

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  concurrency = FAN_OUT_CONCURRENCY,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let next = 0;

  // Index handed out under a shared cursor rather than sliced into batches,
  // so one slow lookup does not hold up the rest of its batch.
  async function run() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );

  return results;
}
