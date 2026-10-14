/**
 * Load a library collection without letting the result undo a newer write.
 *
 * `writeSeq` is bumped by the collection's inflight (`onSettle`) whenever a
 * write settles. A load that started before a write settled may not contain
 * it (or may still contain what it removed), so its result is dropped and the
 * load runs again. After `maxRetries` reruns the result is applied anyway, so
 * a steady stream of writes can't keep the collection from loading.
 */
export async function guardedReload<T>(
  writeSeq: { current: number },
  fetch: () => Promise<T>,
  apply: (data: T) => void,
  maxRetries = 2,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const startedAt = writeSeq.current;
    const data = await fetch();
    if (writeSeq.current === startedAt || attempt >= maxRetries) {
      apply(data);
      return;
    }
  }
}
