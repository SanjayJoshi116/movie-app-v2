import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { RatingEntry, RatingEntryDTO, RatingsMap } from "../types";

function ratingKey(id: number, type: string) { return `${type}-${id}`; }

export function useRatings() {
  const { isAuthenticated } = useAuth();
  const [ratings, setRatings] = useState<RatingsMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const dbIdMap = useRef<Record<string, number>>({});
  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;

  useEffect(() => {
    if (!isAuthenticated) {
      setRatings({});
      dbIdMap.current = {};
      return;
    }
    setIsLoading(true);
    userApi
      .get<RatingEntryDTO[]>("/ratings/")
      .then(({ data }) => {
        const map: Record<string, number> = {};
        const ratingsMap: RatingsMap = {};
        data.forEach((item) => {
          const k = ratingKey(item.mediaId, item.mediaType);
          map[k] = item.id;
          ratingsMap[k] = {
            id: item.mediaId,
            type: item.mediaType,
            title: item.title,
            userRating: item.userRating,
            review: item.review,
            ratedAt: item.ratedAt,
          };
        });
        dbIdMap.current = map;
        setRatings(ratingsMap);
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const set = useCallback(async (
    id: number,
    type: string,
    title: string,
    userRating: number,
    review = ""
  ) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.post<RatingEntryDTO>("/ratings/", {
      mediaId: id,
      mediaType: type,
      title,
      userRating,
      review,
    });
    const k = ratingKey(id, type);
    dbIdMap.current[k] = data.id;
    setRatings((prev) => ({
      ...prev,
      [k]: {
        id,
        type: type as RatingEntry["type"],
        title,
        userRating,
        review,
        ratedAt: data.ratedAt,
      },
    }));
  }, [isAuthenticated]);

  const get = useCallback((id: number, type: string): RatingEntry | null =>
    ratingsRef.current[ratingKey(id, type)] ?? null,
  []);

  const remove = useCallback(async (id: number, type: string) => {
    if (!isAuthenticated) return;
    const k = ratingKey(id, type);
    const dbId = dbIdMap.current[k];
    if (dbId == null) return;
    await userApi.delete(`/ratings/${dbId}/`);
    delete dbIdMap.current[k];
    setRatings((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, [isAuthenticated]);

  return { ratings, isLoading, set, get, remove };
}
