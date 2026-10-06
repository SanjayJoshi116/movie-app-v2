/**
 * Per-key in-flight dedupe for mutations. A second `run()` with a key whose
 * request is still pending gets the same promise back instead of starting a
 * new request, so a double-click settles with the first click's outcome.
 */
export function createInflight() {
  const pending = new Map<string, Promise<unknown>>();

  function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const p = fn().finally(() => {
      if (pending.get(key) === p) pending.delete(key);
    });
    pending.set(key, p);
    return p;
  }

  return { run };
}
