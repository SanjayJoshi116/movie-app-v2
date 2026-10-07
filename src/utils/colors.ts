import { RATING_BAD, RATING_WARN, WATCHED_GREEN } from "../constants/ui";

/** Tag color for a TMDB vote average: green ≥8, amber ≥5, red below. */
export function ratingColor(vote: number): string {
  if (vote >= 8) return WATCHED_GREEN;
  if (vote >= 5) return RATING_WARN;
  return RATING_BAD;
}

export const AVATAR_COLORS = ["#e67e22", "#8e44ad", "#2980b9", "#27ae60", "#c0392b", "#16a085"] as const;

/** Stable fallback avatar background for a username (same name → same color). */
export function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}
