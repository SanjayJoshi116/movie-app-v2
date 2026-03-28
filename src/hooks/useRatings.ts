import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import userApi from "../api/userApi";
import type { RatingEntry, RatingsMap } from "../types";

export function useRatings() {
  const { isAuthenticated } = useAuth();
  const [ratings, setRatings] = useState<RatingsMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const dbIdMap = useRef<Record<string, number>>({});

  const ratingKey = (id: number, type: string) => `${type}-${id}`;

  useEffect(() => {
    if (!isAuthenticated) {
      setRatings({});
      dbIdMap.current = {};
      return;
    }
    setIsLoading(true);
    userApi
      .get("/ratings/")
      .then(({ data }) => {
        const map: Record<string, number> = {};
        const ratingsMap: RatingsMap = {};
        data.forEach((item: any) => {
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

  const set = async (
    id: number,
    type: string,
    title: string,
    userRating: number,
    review = ""
  ) => {
    if (!isAuthenticated) return;
    const { data } = await userApi.post("/ratings/", {
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
  };

  const get = (id: number, type: string): RatingEntry | null =>
    ratings[ratingKey(id, type)] ?? null;

  const remove = async (id: number, type: string) => {
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
  };

  return { ratings, isLoading, set, get, remove };
}
