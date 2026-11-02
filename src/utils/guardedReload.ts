export interface GuardedReloadOptions {
  /**
   * The collection's reload counter. Each call takes the next number; a call
   * that is no longer the newest when its fetch returns drops its result and
   * its error, so an older reload finishing last can't overwrite a newer one.
   */
  reloadSeq: { current: number };
  /** Runs once the newest call settles (applied or failed), before a rethrow. */
  onSettled?: () => void;
  /** Reruns after a write settled mid-load before the result is applied anyway. */
  maxRetries?: number;
}

const SUPERSEDED = Symbol("superseded");

// Per collection (keyed by its counter), the outcome of the newest call.
const newestOutcome = new WeakMap<object, Promise<void>>();

/**
 * Load a library collection without letting the result undo a newer write or
 * a newer reload.
 *
 * `writeSeq` is bumped by the collection's inflight (`onSettle`) whenever a
 * write settles. A load that started before a write settled may not contain
 * it (or may still contain what it removed), so its result is dropped and the
 * load runs again. After `maxRetries` reruns the result is applied anyway, so
 * a steady stream of writes can't keep the collection from loading.
 *
 * Only the newest call applies and calls `onSettled` (where callers clear
 * their loading flag). An older call settles with the newest one's outcome,
 * so whoever awaits it (an import's refresh) sees whether what's shown now
 * loaded or failed.
 */
export function guardedReload<T>(
  writeSeq: { current: number },
  fetch: () => Promise<T>,
  apply: (data: T) => void,
  { reloadSeq, onSettled, maxRetries = 2 }: GuardedReloadOptions,
): Promise<void> {
  const mine = ++reloadSeq.current;
  const isNewest = () => reloadSeq.current === mine;

  const attempt = async (): Promise<void | typeof SUPERSEDED> => {
    for (let n = 0; ; n++) {
      const startedAt = writeSeq.current;
      let data: T;
      try {
        data = await fetch();
      } catch (err) {
        if (!isNewest()) return SUPERSEDED;
        onSettled?.();
        throw err;
      }
      if (!isNewest()) return SUPERSEDED;
      if (writeSeq.current === startedAt || n >= maxRetries) {
        apply(data);
        onSettled?.();
        return;
      }
    }
  };

  // A superseded call follows whichever call is newest by then, never itself.
  const outcome = attempt().then((r) => (r === SUPERSEDED ? newestOutcome.get(reloadSeq) : undefined));
  newestOutcome.set(reloadSeq, outcome);
  return outcome;
}
