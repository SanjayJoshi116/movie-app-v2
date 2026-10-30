import { createContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import {
  getFollowedPeople,
  followPerson,
  unfollowPerson,
  currentSessionGeneration,
  isCurrentSession,
  SessionEndedError,
  type FollowedPersonEntry,
} from "../api/userApi";
import { useAuth } from "./AuthContext";
import { createInflight } from "../utils/inflight";
import { guardedReload } from "../utils/guardedReload";

export interface FollowedPeopleContextType {
  followed: FollowedPersonEntry[];
  loading: boolean;
  /** The list failed to load: `followed` isn't the truth, so don't show "not following". */
  error: boolean;
  /** Clears `error` and fetches the list again. */
  retry(): void;
  /** After follows changed outside follow()/unfollow() (a backup restore):
   *  fetches again, like retry(), and counts as a follow change, so the
   *  notifications refresh. */
  reload(): void;
  isFollowing(personId: number): boolean;
  follow(personId: number, name: string, profilePath: string | null): Promise<void>;
  unfollow(personId: number): Promise<void>;
  /** Called by `useFollowedPeople()` consumers; starts the one-time fetch. */
  request(): void;
  /** Bumped after each successful follow or unfollow (the notifications poller
   *  refreshes on it). Reading it doesn't start the lazy fetch. */
  changes: number;
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
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [changes, setChanges] = useState(0);
  // Bumped when a follow/unfollow settles: a load that started before it is
  // run again rather than applied (guardedReload), like the library hooks.
  const writeSeq = useRef(0);
  const inflight = useRef(createInflight({ onSettle: () => { writeSeq.current += 1; } }));

  useEffect(() => {
    if (!isAuthenticated) {
      setFollowed([]);
      setLoaded(false);
      setError(false);
      setRequested(false);
      return;
    }
    if (!requested) return;
    let cancelled = false;
    const gen = currentSessionGeneration();
    // Dropped after the effect re-ran or the session changed (sign-out lands
    // before this cleanup can), so another account's list is never applied.
    const live = () => !cancelled && isCurrentSession(gen);
    // A rerun (a follow settled meanwhile) never goes out for a dead session:
    // after a sign-out it would 401 with no token and force a logout.
    const fetchIfLive = () => (live() ? getFollowedPeople() : Promise.reject(new SessionEndedError()));
    guardedReload(writeSeq, fetchIfLive, (data) => {
      if (live()) { setFollowed(data); setError(false); }
    })
      // Keep whatever we had: an empty list here used to read as "not following
      // anyone" on the Following page and as "Follow" on every person card.
      .catch(() => { if (live()) setError(true); })
      .finally(() => { if (live()) setLoaded(true); });
    return () => { cancelled = true; };
  }, [isAuthenticated, requested, retryToken]);

  const request = useCallback(() => setRequested(true), []);

  const retry = useCallback(() => {
    setError(false);
    setLoaded(false);
    setRetryToken((t) => t + 1);
  }, []);

  const reload = useCallback(() => {
    retry();
    setChanges((c) => c + 1);
  }, [retry]);

  const isFollowing = useCallback(
    (personId: number) => followed.some((f) => f.personId === personId),
    [followed]
  );

  // Follow and unfollow for one person share an in-flight slot: a repeat of the
  // same action settles with the pending one, the other action runs after it.
  const follow = useCallback(
    (personId: number, name: string, profilePath: string | null) =>
      inflight.current.run(`person-${personId}`, async () => {
        const gen = currentSessionGeneration();
        const res = await followPerson(personId, name, profilePath);
        if (!isCurrentSession(gen)) return;
        // Newest first, like the API (-followed_at), so a reload doesn't move it.
        setFollowed((prev) => [res.data, ...prev.filter((f) => f.personId !== personId)]);
        setChanges((c) => c + 1);
      }, "follow"),
    []
  );

  const unfollow = useCallback(
    (personId: number) =>
      inflight.current.run(`person-${personId}`, async () => {
        const gen = currentSessionGeneration();
        await unfollowPerson(personId);
        if (!isCurrentSession(gen)) return;
        setFollowed((prev) => prev.filter((f) => f.personId !== personId));
        setChanges((c) => c + 1);
      }, "unfollow"),
    []
  );

  const loading = isAuthenticated && !loaded;

  const value = useMemo<FollowedPeopleContextType>(
    () => ({ followed, loading, error, retry, reload, isFollowing, follow, unfollow, request, changes }),
    [followed, loading, error, retry, reload, isFollowing, follow, unfollow, request, changes]
  );

  return <FollowedPeopleContext.Provider value={value}>{children}</FollowedPeopleContext.Provider>;
}
