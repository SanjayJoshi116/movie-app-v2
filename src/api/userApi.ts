import axios from "axios";
import { fetchAllPages } from "../utils/fetchAllPages";

const API_HOST = window.location.hostname;
const DJANGO_BASE = process.env.REACT_APP_API_BASE_URL || `http://${API_HOST}:3001/api/django`;

const userApi = axios.create({
  baseURL: DJANGO_BASE,
});

// No auth interceptors — for public endpoints (login, register, password reset)
const publicApi = axios.create({
  baseURL: DJANGO_BASE,
});

userApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("cinedb_access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

userApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Retry once on 500 after a brief pause — handles transient DB/network blips
    if (error.response?.status === 500 && !original._retry500) {
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
      isRefreshing = true;

      const refresh = localStorage.getItem("cinedb_refresh");
      if (!refresh) {
        isRefreshing = false;
        localStorage.removeItem("cinedb_access");
        localStorage.removeItem("cinedb_refresh");
        localStorage.removeItem("cinedb_user");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${DJANGO_BASE}/auth/token/refresh/`, {
          refresh,
        });
        localStorage.setItem("cinedb_access", data.access);
        processQueue(null, data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return userApi(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem("cinedb_access");
        localStorage.removeItem("cinedb_refresh");
        localStorage.removeItem("cinedb_user");
        window.location.href = "/login";
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

export const updateProfile = (data: Record<string, string>) =>
  userApi.patch("/auth/profile/", data);

export const requestPasswordReset = (email: string) =>
  publicApi.post<{ detail: string }>("/auth/password-reset/", { email });

export const confirmPasswordReset = (uid: string, token: string, newPassword: string) =>
  publicApi.post<{ detail: string }>("/auth/password-reset/confirm/", { uid, token, new_password: newPassword });


export const bulkMarkWatched = (
  entries: { mediaId: number; title: string; posterPath?: string | null; voteAverage?: number }[],
  mediaType: "movie" | "tv",
) => userApi.post<{ added: number; skipped: number }>("/watched/bulk/", { entries, mediaType });

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

export default userApi;
