import axios from "axios";
import { fetchAllPages } from "../utils/fetchAllPages";
import type { MediaType } from "../types";

const API_HOST = window.location.hostname;
const DJANGO_BASE = process.env.REACT_APP_API_BASE_URL || `http://${API_HOST}:8000/api`;

const userApi = axios.create({
  baseURL: DJANGO_BASE,
});

// No auth interceptors — for public endpoints (login, register, password reset)
export const publicApi = axios.create({
  baseURL: DJANGO_BASE,
});

userApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("cinedb_access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * The single client-side session teardown, used by explicit logout and by the
 * forced logout below. Removes tokens, the cached user, recent searches, and
 * every per-tab cache (all sessionStorage keys are account/session-derived, so
 * clear() rather than an allow-list that would rot). Device preferences such
 * as cinedb_theme / cinedb_sidebar_collapsed are kept.
 */
export function clearSession() {
  ["cinedb_access", "cinedb_refresh", "cinedb_user", "cinedb_recent_searches"].forEach((k) =>
    localStorage.removeItem(k)
  );
  sessionStorage.clear();
}

/**
 * sessionStorage write for page caches saved on unmount. Logout runs
 * clearSession() before setUser(null) unmounts the page, so without this guard
 * the cleanup would write the previous user's data straight back.
 */
export function saveSessionCache(key: string, value: string) {
  if (!localStorage.getItem("cinedb_access")) return;
  sessionStorage.setItem(key, value);
}

/** Best-effort server-side revocation of a refresh token. publicApi, so an
 *  expired access token can't trigger a refresh just to log out. */
export const logoutSession = (refresh: string) =>
  publicApi.post("/auth/logout/", { refresh }, { timeout: 5000 });

// Writes are never auto-retried: a POST that succeeded server-side but
// returned 500 would otherwise be duplicated (e.g. two identical lists).
const RETRYABLE_METHODS = ["get", "head", "options"];

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

function forceLogout() {
  clearSession();
  window.location.href = "/login";
}

/** The session this refresh belonged to ended or changed hands (logout, or a
 *  different login) while it was in flight — drop its result, don't redirect. */
class SessionChangedError extends Error {}

function storedUserId(): number | undefined {
  try {
    return JSON.parse(localStorage.getItem("cinedb_user") ?? "null")?.id;
  } catch {
    return undefined;
  }
}

/** Serializes refreshes across tabs: they share one localStorage, so two tabs
 *  refreshing the same rotating token at once would blacklist each other.
 *  Runs unlocked where the Web Locks API is missing (jsdom, old browsers). */
async function withRefreshLock(fn: () => Promise<string>): Promise<string> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks?.request ? await locks.request("cinedb-token-refresh", fn) : fn();
}

const ROTATION_GRACE_MS = 1500;

/** After our refresh is rejected with storage still showing `seenRefresh`: waits
 *  briefly for another tab's rotation to reach this tab (a `storage` event),
 *  instead of logging every tab out over a cross-tab sync lag. Only delays the
 *  genuinely-revoked case, by at most ROTATION_GRACE_MS. */
function rotationArrives(seenRefresh: string): Promise<boolean> {
  const rotated = () => {
    const now = localStorage.getItem("cinedb_refresh");
    return !!now && now !== seenRefresh;
  };
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      window.removeEventListener("storage", onStorage);
      clearTimeout(timer);
      resolve(value);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cinedb_refresh" && rotated()) finish(true);
    };
    window.addEventListener("storage", onStorage);
    const timer = setTimeout(() => finish(rotated()), ROTATION_GRACE_MS);
  });
}

/** Tokens another tab stored after rotating `seenRefresh` — usable only if the
 *  same user is still signed in. */
function adoptStoredAccess(userId: number | undefined): string {
  const access = localStorage.getItem("cinedb_access");
  if (!access || !localStorage.getItem("cinedb_refresh") || storedUserId() !== userId) {
    throw new SessionChangedError();
  }
  return access;
}

/** Returns a fresh access token for the session that owned `seenRefresh`. */
async function refreshTokens(seenRefresh: string, userId: number | undefined): Promise<string> {
  // Another tab already rotated it while we waited for the lock.
  if (localStorage.getItem("cinedb_refresh") !== seenRefresh) return adoptStoredAccess(userId);

  let data: { access: string; refresh?: string };
  try {
    ({ data } = await axios.post(
      `${DJANGO_BASE}/auth/token/refresh/`,
      { refresh: seenRefresh },
      { timeout: 10000 }, // bounded, so a hung request can't hold the cross-tab lock
    ));
  } catch (err) {
    // Another tab may have rotated it while ours was in flight, in which case our
    // rejection (blacklisted token) isn't a dead session. This also covers the
    // locked path: Chromium syncs localStorage across tabs asynchronously, so the
    // check above can read a stale value even after the lock handoff.
    const now = localStorage.getItem("cinedb_refresh");
    if (now && now !== seenRefresh) return adoptStoredAccess(userId);
    if (axios.isAxiosError(err) && err.response?.status === 401 && (await rotationArrives(seenRefresh))) {
      return adoptStoredAccess(userId);
    }
    throw err;
  }

  // Logged out (or someone else logged in) while this was in flight: storing the
  // pair would silently sign the previous user back in.
  if (localStorage.getItem("cinedb_refresh") !== seenRefresh) throw new SessionChangedError();

  localStorage.setItem("cinedb_access", data.access);
  // ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION: the refresh token we just
  // sent is now dead, so the rotated one must be stored or the next refresh
  // (~1h later) fails and forces a logout.
  if (data.refresh) localStorage.setItem("cinedb_refresh", data.refresh);
  return data.access;
}

userApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Retry once on 500 after a brief pause — handles transient DB/network blips
    if (
      error.response?.status === 500 &&
      !original._retry500 &&
      RETRYABLE_METHODS.includes((original.method ?? "get").toLowerCase())
    ) {
      original._retry500 = true;
      await new Promise((r) => setTimeout(r, 2000));
      return userApi(original);
    }

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return userApi(original);
        });
      }

      original._retry = true;

      // Late 401: this request went out with an access token that a refresh has
      // since replaced. Replay it with the current one — refreshing again would
      // submit an already-rotated (blacklisted) refresh token and log the user out.
      const currentAccess = localStorage.getItem("cinedb_access");
      if (currentAccess && original.headers?.Authorization !== `Bearer ${currentAccess}`) {
        original.headers.Authorization = `Bearer ${currentAccess}`;
        return userApi(original);
      }

      const refresh = localStorage.getItem("cinedb_refresh");
      if (!refresh) {
        forceLogout();
        return Promise.reject(error);
      }

      isRefreshing = true;
      try {
        const userId = storedUserId();
        const access = await withRefreshLock(() => refreshTokens(refresh, userId));
        processQueue(null, access);
        original.headers.Authorization = `Bearer ${access}`;
        return userApi(original);
      } catch (err) {
        processQueue(err, null);
        // A changed session already reflects what the user did; only a genuinely
        // dead refresh token ends the session here.
        if (!(err instanceof SessionChangedError)) forceLogout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export type PersonalizedRecItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  posterPath: string | null;
  voteAverage: number;
};

export type PersonalizedRecSection = {
  key: string;
  label: string;
  items: PersonalizedRecItem[];
};

export type RecommendationsResponse = {
  status: "ready" | "pending";
  sections: PersonalizedRecSection[];
};

export const fetchPersonalizedRecommendations = () =>
  userApi.get<RecommendationsResponse>("/recommendations/personalized/");

export const fetchForYouRecommendations = () =>
  userApi.get<RecommendationsResponse>("/recommendations/for-you/");

export const uploadAvatar = (file: File) => {
  const formData = new FormData();
  formData.append("avatar", file);
  return userApi.post("/auth/avatar/", formData);
};

export const removeAvatar = () => userApi.delete("/auth/avatar/");

export const requestPasswordReset = (email: string) =>
  publicApi.post<{ detail: string }>("/auth/password-reset/", { email });

export const confirmPasswordReset = (uid: string, token: string, newPassword: string) =>
  publicApi.post<{ detail: string }>("/auth/password-reset/confirm/", { uid, token, new_password: newPassword });


export const bulkMarkWatched = (
  entries: { mediaId: number; title: string; posterPath?: string | null; voteAverage?: number }[],
  mediaType: "movie" | "tv",
) => userApi.post<{ added: number; skipped: number }>("/watched/bulk/", { entries, mediaType });

/** Server-side cap per bulk request (MAX_BULK_ENTRIES in bulk_import.py). */
export const BULK_CHUNK_SIZE = 500;

export interface BulkImportEntry {
  mediaId: number;
  mediaType?: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  voteAverage?: number;
  addedAt?: string;
  watchedAt?: string;
  runtimeMinutes?: number | null;
  platform?: string | null;
  userRating?: number;
  review?: string;
  ratedAt?: string;
}

export interface BulkImportResult {
  added: number;
  skipped: number;
  failed: number;
}

/**
 * Import any number of entries through a bulk endpoint, BULK_CHUNK_SIZE per
 * request, sequentially. Each request is all-or-nothing server-side, so a
 * rejected chunk counts all its entries as failed and the rest still go through.
 */
export async function bulkImport(
  kind: "watched" | "watchlist" | "ratings",
  entries: BulkImportEntry[],
): Promise<BulkImportResult> {
  const result: BulkImportResult = { added: 0, skipped: 0, failed: 0 };
  for (let i = 0; i < entries.length; i += BULK_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + BULK_CHUNK_SIZE);
    try {
      const { data } = await userApi.post<{ added: number; skipped: number }>(`/${kind}/bulk/`, { entries: chunk });
      result.added += data.added;
      result.skipped += data.skipped;
    } catch {
      result.failed += chunk.length;
    }
  }
  return result;
}

export const getTMDBRequestToken = (callbackUrl: string) =>
  userApi.get<{ redirect_url: string; request_token: string }>("/tmdb-auth/request-token/", {
    params: { redirect_to: callbackUrl },
  });

export const createTMDBSession = (requestToken: string) =>
  userApi.post<{ connected: boolean }>("/tmdb-auth/create-session/", { request_token: requestToken });

export const getTMDBAuthStatus = () =>
  userApi.get<{ connected: boolean }>("/tmdb-auth/status/");

export const disconnectTMDB = () =>
  userApi.delete<{ connected: boolean }>("/tmdb-auth/disconnect/");

export interface StatsData {
  totalWatched: number;
  moviesCount: number;
  tvCount: number;
  totalRatings: number;
  avgUserRating: number;
  avgTmdbRating: number | null;
  ratingDistribution: { rating: string; count: number }[];
  monthlyActivity: { month: string; count: number }[];
  topGenres: { genre: string; count: number }[];
  languageBreakdown: { language: string; count: number }[];
  decadeBreakdown: { decade: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  topRatedItems: { title: string; posterPath: string | null; userRating: number; mediaType: string }[];
  recentItems: { title: string; posterPath: string | null; watchedAt: string; mediaType: string }[];
  totalRuntimeMinutes: number;
  platformBreakdown: { platform: string; count: number }[];
  ratingByGenre: { genre: string; avgRating: number }[];
  reviewsWritten: number;
  listsCount: number;
  listsItemsCount: number;
  watchlistTotal: number;
  watchlistUnwatched: number;
}

export const fetchStats = () => userApi.get<StatsData>("/stats/");

export interface EpisodeProgressData {
  showId: number;
  season: number;
  episode: number;
}

export const getEpisodeProgress = (showId: number) =>
  userApi.get<EpisodeProgressData | null>(`/episode-progress/${showId}/`);

export const setEpisodeProgress = (showId: number, season: number, episode: number) =>
  userApi.post<EpisodeProgressData>(`/episode-progress/${showId}/`, { season, episode });

export const deleteEpisodeProgress = (showId: number) =>
  userApi.delete(`/episode-progress/${showId}/`);

export interface FollowedPersonEntry {
  id: number;
  personId: number;
  name: string;
  profilePath: string | null;
}

export const getFollowedPeople = () =>
  fetchAllPages<FollowedPersonEntry>(userApi, "/followed-people/");

export const followPerson = (personId: number, name: string, profilePath: string | null) =>
  userApi.post<FollowedPersonEntry>("/followed-people/", { personId, name, profilePath });

export const unfollowPerson = (personId: number) =>
  userApi.delete(`/followed-people/${personId}/`);

export const fetchFollowedPeopleRecommendations = () =>
  userApi.get<PersonalizedRecSection[]>("/recommendations/followed-people/");

export interface NewReleaseNotification {
  id: number;
  type: MediaType;
  title: string;
  posterPath: string | null;
  releaseDate: string;
  personName: string;
  isUnread: boolean;
}

export interface NewReleaseNotificationsResponse {
  items: NewReleaseNotification[];
  unreadCount: number;
}

export const fetchNewReleaseNotifications = () =>
  userApi.get<NewReleaseNotificationsResponse>("/notifications/new-releases/");

export const markNotificationsSeen = () => userApi.post("/notifications/mark-seen/");

export default userApi;
