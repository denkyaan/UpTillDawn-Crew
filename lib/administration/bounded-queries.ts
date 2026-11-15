/**
 * Await lazy PostgREST query builders with a strict concurrency budget.
 * Preserves ordered, typed query results and propagates failures.
 * Pass lazy thenables here, never promises which have already started fetches.
 */
export async function boundedQueries<const T extends readonly PromiseLike<unknown>[]>(
  queries: T,
  limit: number,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Query concurrency limit must be a positive integer")
  }
  const results: unknown[] = new Array(queries.length)
  let next = 0
  await Promise.all(Array.from({length: Math.min(limit, queries.length)}, async () => {
    while (next < queries.length) {
      const index = next++
      results[index] = await queries[index]
    }
  }))
  return results as { [K in keyof T]: Awaited<T[K]> }
}
