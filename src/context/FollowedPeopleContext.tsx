import { createContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import {
  getFollowedPeople,
  followPerson,
  unfollowPerson,
  type FollowedPersonEntry,
} from "../api/userApi";
import { useAuth } from "./AuthContext";
import { createInflight } from "../utils/inflight";

export interface FollowedPeopleContextType {
  followed: FollowedPersonEntry[];
  loading: boolean;
  isFollowing(personId: number): boolean;
  follow(personId: number, name: string, profilePath: string | null): Promise<void>;
  unfollow(personId: number): Promise<void>;
  /** Called by `useFollowedPeople()` consumers; starts the one-time fetch. */
  request(): void;
}

export const FollowedPeopleContext = createContext<FollowedPeopleContextType | null>(null);

/**
 * One app-wide copy of the followed-people list. A grid of PersonCards used to
 * instantiate its own hook per card (N fetches, N unshared copies), so an
 * unfollow on one card never reached the Following page's list.
 *
 * The fetch is lazy: it starts when the first consumer mounts, not on every
 * authenticated page. That keeps it off pages that never show follow state, and
 * out of every e2e base fixture (an unconditional endpoint left unmocked there
 * 401s and redirects the whole test to /login, per CLAUDE.md).
 */
export function FollowedPeopleProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [followed, setFollowed] = useState<FollowedPersonEntry[]>([]);
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inflight = useRef(createInflight());

  useEffect(() => {
    if (!isAuthenticated) {
      setFollowed([]);
      setLoaded(false);
      setRequested(false);
      return;
    }
    if (!requested) return;
    let cancelled = false;
    getFollowedPeople()
      .then((data) => { if (!cancelled) setFollowed(data); })
      .catch(() => { if (!cancelled) setFollowed([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [isAuthenticated, requested]);

  const request = useCallback(() => setRequested(true), []);

  const isFollowing = useCallback(
    (personId: number) => followed.some((f) => f.personId === personId),
    [followed]
  );

  // Follow and unfollow for one person share an in-flight slot (double-click guard).
  const follow = useCallback(
    (personId: number, name: string, profilePath: string | null) =>
      inflight.current.run(`person-${personId}`, async () => {
        const res = await followPerson(personId, name, profilePath);
        setFollowed((prev) => [...prev.filter((f) => f.personId !== personId), res.data]);
      }),
    []
  );

  const unfollow = useCallback(
    (personId: number) =>
      inflight.current.run(`person-${personId}`, async () => {
        await unfollowPerson(personId);
        setFollowed((prev) => prev.filter((f) => f.personId !== personId));
      }),
    []
  );

  const loading = isAuthenticated && !loaded;

  const value = useMemo<FollowedPeopleContextType>(
    () => ({ followed, loading, isFollowing, follow, unfollow, request }),
    [followed, loading, isFollowing, follow, unfollow, request]
  );

  return <FollowedPeopleContext.Provider value={value}>{children}</FollowedPeopleContext.Provider>;
}
