import axios from "axios";

/**
 * Pacing for imports that look something up on TMDB per row (posters,
 * scores). The TMDB proxy allows 120 requests a minute per user
 * (`tmdb_proxy` in settings.py), shared with whatever the user browses, so
 * imports take 90 of them and wait out a 429 instead of dropping the row.
 */
export const LOOKUPS_PER_MINUTE = 90;
export const MAX_IN_FLIGHT = 4;
/** Tries per item when TMDB answers 429 (rate-limited). */
export const MAX_RATE_LIMITED_TRIES = 3;
/** Wait after a 429 without a usable Retry-After header. */
export const DEFAULT_RETRY_AFTER_MS = 10_000;

const INTERVAL_MS = 60_000 / LOOKUPS_PER_MINUTE;

// One schedule for every import in the tab, so two running at once still
// share the budget.
let nextSlotAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wait for the next free request slot. */
async function takeSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlotAt);
  nextSlotAt = at + INTERVAL_MS;
  if (at > now) await sleep(at - now);
}

function retryAfterMs(err: unknown): number {
  if (!axios.isAxiosError(err)) return DEFAULT_RETRY_AFTER_MS;
  const header = err.response?.headers?.["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_RETRY_AFTER_MS;
}

const statusOf = (err: unknown) => (axios.isAxiosError(err) ? err.response?.status : undefined);

/** One item: undefined when TMDB doesn't have it or the lookup kept failing. */
async function lookupOne<T, R>(item: T, lookup: (item: T) => Promise<R>): Promise<R | undefined> {
  let rateLimited = 0;
  let otherFailures = 0;
  for (;;) {
    await takeSlot();
    try {
      return await lookup(item);
    } catch (err) {
      const status = statusOf(err);
      if (status === 404) return undefined; // TMDB doesn't know this id: final
      if (status === 429) {
        if (++rateLimited >= MAX_RATE_LIMITED_TRIES) return undefined;
        await sleep(retryAfterMs(err));
        continue;
      }
      if (++otherFailures > 1) return undefined;
    }
  }
}

export interface PacedResult<R> {
  /** Same order as the input; undefined where no result was found. */
  results: (R | undefined)[];
  /** How many items ended without a result. */
  missing: number;
}

/**
 * Run `lookup` for every item, at most MAX_IN_FLIGHT at a time and
 * LOOKUPS_PER_MINUTE overall. Never rejects: an item whose lookup fails is
 * counted in `missing`, so the caller can still import it and say so.
 */
export async function pacedLookup<T, R>(
  items: T[],
  lookup: (item: T) => Promise<R>,
  { onProgress }: { onProgress?: (done: number, total: number) => void } = {},
): Promise<PacedResult<R>> {
  const results: (R | undefined)[] = new Array(items.length);
  let next = 0;
  let done = 0;
  onProgress?.(0, items.length);
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await lookupOne(items[index]!, lookup);
      onProgress?.(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, items.length) }, worker));
  return { results, missing: results.filter((r) => r === undefined).length };
}

/** Tests only: forget the shared schedule. */
export function resetPacer(): void {
  nextSlotAt = 0;
}
