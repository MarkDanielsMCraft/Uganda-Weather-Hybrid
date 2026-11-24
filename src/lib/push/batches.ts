/** Sending to thousands of phones at once can time out the whole alert job,
    so sends go out in groups and each group finishes before the next starts. */
export const PUSH_SEND_BATCH_SIZE = 50;

export async function mapInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    results.push(...(await Promise.all(batch.map(task))));
  }
  return results;
}
