/** Where the user is in a show: the episode they're on (spoiler-shield). */
export interface ShieldProgress {
  season: number;
  episode: number;
}

/**
 * Whether an episode comes after the tracked one. The tracked episode itself
 * counts as reached (Track sets S1E1, which the user is about to watch), and
 * specials (season 0) have no place in the order, so they're never hidden.
 */
export function isEpisodeHidden(season: number, episode: number, progress: ShieldProgress | null): boolean {
  if (!progress || season === 0) return false;
  return season > progress.season || (season === progress.season && episode > progress.episode);
}
