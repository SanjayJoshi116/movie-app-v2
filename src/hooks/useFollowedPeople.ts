import { useState, useEffect, useCallback } from "react";
import {
  getFollowedPeople,
  followPerson,
  unfollowPerson,
  type FollowedPersonEntry,
} from "../api/userApi";
import { useAuth } from "../context/AuthContext";

export function useFollowedPeople() {
  const { isAuthenticated } = useAuth();
  const [followed, setFollowed] = useState<FollowedPersonEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setFollowed([]); return; }
    setLoading(true);
    getFollowedPeople()
      .then((data) => setFollowed(data))
      .catch(() => setFollowed([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const isFollowing = useCallback(
    (personId: number) => followed.some((f) => f.personId === personId),
    [followed]
  );

  const follow = useCallback(
    async (personId: number, name: string, profilePath: string | null) => {
      const res = await followPerson(personId, name, profilePath);
      setFollowed((prev) => [...prev.filter((f) => f.personId !== personId), res.data]);
    },
    []
  );

  const unfollow = useCallback(async (personId: number) => {
    await unfollowPerson(personId);
    setFollowed((prev) => prev.filter((f) => f.personId !== personId));
  }, []);

  return { followed, loading, isFollowing, follow, unfollow };
}
