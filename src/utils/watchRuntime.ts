import type { MediaType } from "../types";

/** The detail fields a watch runtime is derived from. Any can be missing. */
export interface RuntimeSource {
  runtime?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[] | null;
  last_episode_to_air?: { runtime?: number | null } | null;
}

const positive = (n: unknown): number | undefined =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;

/**
 * Minutes to prefill in Mark as Watched (mark-watched: "Watch runtime is
 * prefilled and editable"). A movie is its runtime. A TV watch is the whole
 * series: episodes × episode length, where the length falls back to the latest
 * aired episode's runtime because newer shows often list no `episode_run_time`.
 * Unknown → undefined, so the field is left blank for the user to fill.
 */
export function prefillRuntime(mediaType: MediaType, details: RuntimeSource | null | undefined): number | undefined {
  if (!details) return undefined;
  if (mediaType === "movie") return positive(details.runtime);
  const episodes = positive(details.number_of_episodes);
  const perEpisode = positive(details.episode_run_time?.[0]) ?? positive(details.last_episode_to_air?.runtime);
  return episodes && perEpisode ? episodes * perEpisode : undefined;
}
