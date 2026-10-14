/**
 * Per-key in-flight control for mutations.
 *
 * - A repeated `run()` with a key whose request is still pending, for the same
 *   action (or with no action), gets the same promise back instead of starting
 *   a new request, so a double-click settles with the first click's outcome.
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
  /** Settles once nothing is pending here or in any group. */
  whenIdle(): Promise<void>;
  group(id: string | number): Inflight;
}

export interface InflightOptions {
  /** Called whenever a run (or exclusive run) settles, success or failure. */
  onSettle?: () => void;
}

const ignore = () => undefined;

export function createInflight({ onSettle }: InflightOptions = {}): Inflight {
  const pending = new Map<string, { action?: string; promise: Promise<unknown> }>();
  let exclusive: { action?: string; promise: Promise<unknown> } | null = null;
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
    if (existing && existing.action === action) return existing.promise as Promise<T>;
    const waits = [existing?.promise, exclusive?.promise].filter((w): w is Promise<unknown> => !!w);
    const p = track(
      // Nothing to wait for: call fn now, as callers (and the double-click
      // dedupe) expect the request to start synchronously.
      waits.length === 0 ? fn : () => Promise.all(waits.map((w) => w.catch(ignore))).then(fn),
      (settled) => { if (pending.get(key)?.promise === settled) pending.delete(key); },
    );
    pending.set(key, { action, promise: p });
    return p;
  }

  function runExclusive<T>(fn: () => Promise<T>, action = "exclusive"): Promise<T> {
    if (exclusive && exclusive.action === action) return exclusive.promise as Promise<T>;
    const waits = [...[...pending.values()].map((e) => e.promise), exclusive?.promise]
      .filter((w): w is Promise<unknown> => !!w);
    const p = track(
      waits.length === 0 ? fn : () => Promise.all(waits.map((w) => w.catch(ignore))).then(fn),
      (settled) => { if (exclusive?.promise === settled) exclusive = null; },
    );
    exclusive = { action, promise: p };
    return p;
  }

  async function whenIdle(): Promise<void> {
    for (;;) {
      const waits = [...[...pending.values()].map((e) => e.promise), exclusive?.promise]
        .filter((w): w is Promise<unknown> => !!w);
      if (waits.length === 0) break;
      await Promise.all(waits.map((w) => w.catch(ignore)));
    }
    await Promise.all([...groups.values()].map((g) => g.whenIdle()));
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

  return { run, runExclusive, whenIdle, group };
}
