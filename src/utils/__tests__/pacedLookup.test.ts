import { pacedLookup, resetPacer, LOOKUPS_PER_MINUTE, MAX_IN_FLIGHT } from "../pacedLookup";

/** What axios rejects with for an HTTP error (axios.isAxiosError checks the flag). */
const httpError = (status: number, headers: Record<string, string> = {}) => ({
  isAxiosError: true,
  response: { status, headers },
});

/** Jest 27 has no async timer helpers: step fake time and let promises settle in between. */
async function runWithTimers<T>(promise: Promise<T>, stepMs = 50, maxMs = 30 * 60_000): Promise<T> {
  let settled = false;
  let value: T;
  promise.then((v) => { settled = true; value = v; });
  for (let t = 0; !settled && t < maxMs; t += stepMs) {
    jest.advanceTimersByTime(stepMs);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }
  if (!settled) throw new Error("pacedLookup never finished");
  return value!;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  resetPacer();
});

afterEach(() => {
  jest.useRealTimers();
});

it("stays under the per-minute budget and in-flight cap", async () => {
  const startedAt: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const lookup = async (n: number) => {
    startedAt.push(Date.now());
    maxInFlight = Math.max(maxInFlight, ++inFlight);
    await new Promise((r) => setTimeout(r, 300));
    inFlight--;
    return n * 2;
  };
  const items = Array.from({ length: 200 }, (_, i) => i);
  const { results, missing } = await runWithTimers(pacedLookup(items, lookup));

  expect(missing).toBe(0);
  expect(results).toEqual(items.map((n) => n * 2));
  expect(maxInFlight).toBeLessThanOrEqual(MAX_IN_FLIGHT);
  // Any LOOKUPS_PER_MINUTE + 1 consecutive starts span a minute, give or take
  // the 50 ms fake-time step that delays when a start is observed.
  for (let i = 0; i + LOOKUPS_PER_MINUTE < startedAt.length; i++) {
    expect(startedAt[i + LOOKUPS_PER_MINUTE]! - startedAt[i]!).toBeGreaterThanOrEqual(60_000 - 50);
  }
});

it("waits out a 429 for Retry-After and then gets the result", async () => {
  const calls: number[] = [];
  const lookup = async () => {
    calls.push(Date.now());
    if (calls.length === 1) throw httpError(429, { "retry-after": "5" });
    return "/poster.jpg";
  };
  const { results, missing } = await runWithTimers(pacedLookup(["550"], lookup));
  expect(results).toEqual(["/poster.jpg"]);
  expect(missing).toBe(0);
  expect(calls[1]! - calls[0]!).toBeGreaterThanOrEqual(5_000);
});

it("gives up on an item that stays rate-limited, without failing the rest", async () => {
  const lookup = async (id: string) => {
    if (id === "bad") throw httpError(429);
    return id;
  };
  const { results, missing } = await runWithTimers(pacedLookup(["a", "bad", "b"], lookup));
  expect(results).toEqual(["a", undefined, "b"]);
  expect(missing).toBe(1);
});

it("doesn't retry a 404 and counts it as missing", async () => {
  let calls = 0;
  const lookup = async () => {
    calls++;
    throw httpError(404);
  };
  const { missing } = await runWithTimers(pacedLookup(["999999"], lookup));
  expect(calls).toBe(1);
  expect(missing).toBe(1);
});

it("retries another failure once", async () => {
  let calls = 0;
  const lookup = async () => {
    if (++calls === 1) throw new Error("network");
    return "ok";
  };
  const { results } = await runWithTimers(pacedLookup(["x"], lookup));
  expect(results).toEqual(["ok"]);
  expect(calls).toBe(2);
});

it("reports progress up to the total", async () => {
  const progress: [number, number][] = [];
  await runWithTimers(pacedLookup([1, 2, 3], async (n) => n, { onProgress: (d, t) => progress.push([d, t]) }));
  expect(progress[0]).toEqual([0, 3]);
  expect(progress[progress.length - 1]).toEqual([3, 3]);
});
