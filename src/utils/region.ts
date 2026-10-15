/** Fallback whenever the device's region is unknown or TMDB has nothing for it. */
export const FALLBACK_REGION = "US";

/**
 * The device's region from its locale (`en-IN` → "IN"; a bare language is
 * expanded to its likeliest region, `hi` → "IN", `en` → "US"). US when none.
 */
export function deviceRegion(locale: string | undefined = typeof navigator !== "undefined" ? navigator.language : undefined): string {
  try {
    const region = locale ? new Intl.Locale(locale).maximize().region : undefined;
    return region && /^[A-Z]{2}$/.test(region) ? region : FALLBACK_REGION;
  } catch {
    return FALLBACK_REGION;
  }
}

/** A region's English name ("IN" → "India"), or the code itself. */
export function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface PickedRegion<T> {
  /** The region `data` is for (the user's, or the US as a fallback). */
  code: string;
  data: T | undefined;
  /** True when the user's region had nothing and US data is shown instead. */
  fallback: boolean;
}

/**
 * TMDB data keyed by region (watch providers, release dates): the user's
 * region's entry, else the US one marked as a fallback, else nothing.
 */
export function pickRegion<T>(byRegion: Record<string, T> | undefined, region: string): PickedRegion<T> {
  const own = byRegion?.[region];
  if (own !== undefined) return { code: region, data: own, fallback: false };
  const us = region !== FALLBACK_REGION ? byRegion?.[FALLBACK_REGION] : undefined;
  if (us !== undefined) return { code: FALLBACK_REGION, data: us, fallback: true };
  return { code: region, data: undefined, fallback: false };
}
