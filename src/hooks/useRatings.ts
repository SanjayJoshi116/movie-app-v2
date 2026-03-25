import { useLocalStorage } from "./useLocalStorage";
import type { RatingEntry, RatingsMap } from "../types";

export function useRatings() {
  const [ratings, setRatings] = useLocalStorage<RatingsMap>("cinedb_ratings", {});

  const ratingKey = (id: number, type: string) => `${type}-${id}`;

  const set = (
    id: number,
    type: string,
    title: string,
    userRating: number,
    review = ""
  ) => {
    setRatings((prev) => ({
      ...prev,
      [ratingKey(id, type)]: {
        id,
        type: type as RatingEntry["type"],
        title,
        userRating,
        review,
        ratedAt: new Date().toISOString(),
      },
    }));
  };

  const get = (id: number, type: string): RatingEntry | null =>
    ratings[ratingKey(id, type)] ?? null;

  const remove = (id: number, type: string) => {
    setRatings((prev) => {
      const next = { ...prev };
      delete next[ratingKey(id, type)];
      return next;
    });
  };

  return { ratings, set, get, remove };
}
