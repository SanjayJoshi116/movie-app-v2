/**
 * A whole number read from the address, or `fallback` when it's missing,
 * malformed (`1.5`, `abc`), below `min`, or not one of `allowed`.
 */
export function parseIntParam(
  value: string | null,
  { fallback, min, allowed }: { fallback: number; min?: number; allowed?: readonly number[] },
): number {
  if (value === null || !/^-?\d+$/.test(value.trim())) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return fallback;
  if (min !== undefined && n < min) return fallback;
  if (allowed && !allowed.includes(n)) return fallback;
  return n;
}

/** `value` if it's one of `keys`, else `fallback`. */
export function pickKey<K extends string>(value: string | null, keys: readonly K[], fallback: K): K {
  return keys.includes(value as K) ? (value as K) : fallback;
}
