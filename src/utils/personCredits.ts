import type { MediaCardGridItem } from "../components/MediaCardGrid";
import type { TMDBPersonCombinedCredit } from "../types";

/** A title's release or first-air date; "" when TMDB has none. */
export function creditDate(c: TMDBPersonCombinedCredit): string {
  const date = "release_date" in c ? c.release_date : "first_air_date" in c ? c.first_air_date : "";
  return typeof date === "string" ? date : "";
}

/** Newest first; undated titles last (person-credits spec). ISO dates sort as strings. */
export function byDateDesc(a: string, b: string): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return b.localeCompare(a);
}

/** One entry per title: a person credited twice on the same title gets their roles joined. */
export function mergeCredits(cast: TMDBPersonCombinedCredit[]): TMDBPersonCombinedCredit[] {
  const byId = new Map<number, TMDBPersonCombinedCredit>();
  for (const c of cast) {
    const prev = byId.get(c.id);
    if (!prev) {
      byId.set(c.id, c);
    } else if (c.character && !(prev.character ?? "").split(" / ").includes(c.character)) {
      byId.set(c.id, { ...prev, character: prev.character ? `${prev.character} / ${c.character}` : c.character });
    }
  }
  return Array.from(byId.values());
}

/** Credits ordered newest first, undated last. */
export function sortCreditsNewestFirst(credits: TMDBPersonCombinedCredit[]): TMDBPersonCombinedCredit[] {
  return [...credits].sort((a, b) => byDateDesc(creditDate(a), creditDate(b)));
}

export type CrewCardItem = MediaCardGridItem & { mediaType: "movie" | "tv"; date: string };

/**
 * Movie and TV crew credits as one list: one card per title per media type,
 * with every job the person had on it joined ("Director, Writer"), newest first.
 * `movie_credits`/`tv_credits` entries carry no `media_type`, so it comes from
 * which list a credit was in.
 */
export function mergeCrew(movieCrew: TMDBPersonCombinedCredit[], tvCrew: TMDBPersonCombinedCredit[]): CrewCardItem[] {
  const byKey = new Map<string, CrewCardItem & { jobs: string[] }>();
  const add = (c: TMDBPersonCombinedCredit, mediaType: "movie" | "tv") => {
    const key = `${mediaType}-${c.id}`;
    const job = typeof c.job === "string" ? c.job.trim() : "";
    const prev = byKey.get(key);
    if (prev) {
      if (job && !prev.jobs.includes(job)) prev.jobs.push(job);
      return;
    }
    byKey.set(key, {
      id: c.id,
      mediaType,
      posterPath: c.poster_path,
      name: "title" in c ? c.title : c.name,
      date: creditDate(c),
      jobs: job ? [job] : [],
    });
  };
  movieCrew.forEach((c) => add(c, "movie"));
  tvCrew.forEach((c) => add(c, "tv"));
  return Array.from(byKey.values())
    .map(({ jobs, ...item }) => ({ ...item, subtitle: jobs.join(", ") || undefined }))
    .sort((a, b) => byDateDesc(a.date, b.date));
}
