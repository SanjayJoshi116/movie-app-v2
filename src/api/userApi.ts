import axios from "axios";

const userApi = axios.create({
  baseURL: "http://localhost:8000/api",
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
        const { data } = await axios.post("http://localhost:8000/api/auth/token/refresh/", {
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

export const fetchPersonalizedRecommendations = () =>
  userApi.get<PersonalizedRecSection[]>("/recommendations/personalized/");

export default userApi;
