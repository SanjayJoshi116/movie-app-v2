/**
 * Per-key in-flight control for mutations.
 *
 * - A repeated `run()` with a key whose request is still pending, for the same
 *   action (or with no action), gets the same promise back instead of starting
 *   a new request, so a double-click settles with the first click's outcome.
 *   Not when a `runExclusive()` started after that request: the repeat then
 *   queues behind the clear and reports its own outcome (add, clear, add again
 *   ends with the title in the collection). Likewise a repeated clear joins
 *   the pending one only when no item run was queued after it (clear, add,
 *   clear again ends empty).
 * - A *different* action on the same key waits for the pending one to settle
 *   and then runs, resolving with its own outcome. Sharing the pending promise
 *   made "Unmark" report a "Mark" (and "Remove" an episode advance).
 * - `runExclusive()` (a clear) waits for every pending run, and every run
 *   started while it's pending waits for it, so a clear and item writes apply
 *   in the order the user acted.
 * - `group(id)` is an inflight scoped to one sub-collection (one list), so a
 *   list's clear is exclusive within that list only.
 */
export interface Inflight {
  run<T>(key: string, fn: () => Promise<T>, action?: string): Promise<T>;
  runExclusive<T>(fn: () => Promise<T>, action?: string): Promise<T>;
  group(id: string | number): Inflight;
}

export interface InflightOptions {
  /** Called whenever a run (or exclusive run) settles, success or failure. */
  onSettle?: () => void;
}

const ignore = () => undefined;

export function createInflight({ onSettle }: InflightOptions = {}): Inflight {
  // `exclusiveGen` is the count of exclusive runs started before the entry.
  const pending = new Map<string, { action?: string; promise: Promise<unknown>; exclusiveGen: number }>();
  // `runGen` is the count of item runs started before the exclusive run.
  let exclusive: { action?: string; promise: Promise<unknown>; runGen: number } | null = null;
  let exclusiveGen = 0;
  let runGen = 0;
  const groups = new Map<string, Inflight>();

  function track<T>(start: () => Promise<T>, done: (p: Promise<T>) => void): Promise<T> {
    const p: Promise<T> = start().finally(() => {
      done(p);
      onSettle?.();
    });
    return p;
  }

  function run<T>(key: string, fn: () => Promise<T>, action?: string): Promise<T> {
    const existing = pending.get(key);
    if (existing && existing.action === action && existing.exclusiveGen === exclusiveGen) {
      return existing.promise as Promise<T>;
    }
    const waits = [existing?.promise, exclusive?.promise].filter((w): w is Promise<unknown> => !!w);
    const p = track(
      // Nothing to wait for: call fn now, as callers (and the double-click
      // dedupe) expect the request to start synchronously.
      waits.length === 0 ? fn : () => Promise.all(waits.map((w) => w.catch(ignore))).then(fn),
      (settled) => { if (pending.get(key)?.promise === settled) pending.delete(key); },
    );
    pending.set(key, { action, promise: p, exclusiveGen });
    runGen += 1;
    return p;
  }

  function runExclusive<T>(fn: () => Promise<T>, action = "exclusive"): Promise<T> {
    if (exclusive && exclusive.action === action && exclusive.runGen === runGen) {
      return exclusive.promise as Promise<T>;
    }
    const waits = [...[...pending.values()].map((e) => e.promise), exclusive?.promise]
      .filter((w): w is Promise<unknown> => !!w);
    const p = track(
      waits.length === 0 ? fn : () => Promise.all(waits.map((w) => w.catch(ignore))).then(fn),
      (settled) => { if (exclusive?.promise === settled) exclusive = null; },
    );
    exclusive = { action, promise: p, runGen };
    exclusiveGen += 1;
    return p;
  }

  function group(id: string | number): Inflight {
    const name = String(id);
    let g = groups.get(name);
    if (!g) {
      g = createInflight({ onSettle });
      groups.set(name, g);
    }
    return g;
  }

  return { run, runExclusive, group };
}
