import { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ConfigProvider, App as AntApp } from "antd";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import { FilterPanel } from "./components/layout/FilterPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAppContext } from "./context/useAppContext";
import { useAuth } from "./context/AuthContext";
import { darkThemeConfig, lightThemeConfig } from "./theme/antdTheme";
import type { FilterValues, SortOption } from "./types";
import { browseScope, DEFAULT_SORT, type BrowseScope } from "./utils/browseFilters";
import "./App.css";

const HomePage = lazy(() => import("./pages/HomePage"));
const MovieDetailPage = lazy(() => import("./pages/MovieDetailPage"));
const TVDetailPage = lazy(() => import("./pages/TVDetailPage"));
const PersonPage = lazy(() => import("./pages/PersonPage"));
const ListDetailPage = lazy(() => import("./pages/ListDetailPage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const WatchedPage = lazy(() => import("./pages/WatchedPage"));
const AnimePage = lazy(() => import("./pages/AnimePage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ListsPage = lazy(() => import("./pages/ListsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));const FollowingPage = lazy(() => import("./pages/FollowingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const TMDBCallbackPage = lazy(() => import("./pages/TMDBCallbackPage"));

function AppInner() {
  const location = useLocation();
  const { theme, clearGenres } = useAppContext();
  const { isAuthenticated, isLoading } = useAuth();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(null);
  const [activeSortBy, setActiveSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [animeMediaType, setAnimeMediaType] = useState<"tv" | "movies">("tv");

  // Applied filters belong to one browse media type. Off browse pages the
  // scope is null and nothing resets, so Movies → detail → Movies keeps them;
  // entering a different scope drops them. The reset happens during render
  // (not in an effect) so the newly mounted page never fetches with the
  // previous scope's filters.
  const filterScope = browseScope(location.pathname, animeMediaType);
  const [appliedScope, setAppliedScope] = useState<BrowseScope | null>(filterScope);
  if (filterScope !== null && filterScope !== appliedScope) {
    setAppliedScope(filterScope);
    setActiveFilters(null);
    setActiveSortBy(DEFAULT_SORT);
  }
  // Genres live in UIContext (a parent provider), which can't be updated
  // during this render; pages also run selected ids through genresFor().
  useEffect(() => {
    if (appliedScope !== null) clearGenres();
  }, [appliedScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPublicPath =
    ["/login", "/register", "/forgot-password"].includes(location.pathname) ||
    location.pathname.startsWith("/reset-password/");
  if (!isLoading && !isAuthenticated && !isPublicPath) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isBrowsePage = filterScope !== null;
  const isMovieForFilter = filterScope === "movie" || filterScope === "anime-movies";

  const handleApplyFilters = (filters: FilterValues, sortBy: SortOption) => {
    setActiveFilters(filters);
    setActiveSortBy(sortBy);
    setShowFilterPanel(false);
  };

  const handleResetFilters = () => {
    setActiveFilters(null);
    setActiveSortBy(DEFAULT_SORT);
  };

  return (
    <ConfigProvider theme={theme === "dark" ? darkThemeConfig : lightThemeConfig}>
      <AntApp>
      <div className="app-shell">
        {isAuthenticated && (
          <Sidebar
            isBrowsePage={isBrowsePage}
            showFilterPanel={showFilterPanel}
            onToggleFilterPanel={() => setShowFilterPanel((v) => !v)}
          />
        )}

        <main className="app-content">
          {isBrowsePage && (
            <FilterPanel
              key={filterScope}
              open={showFilterPanel}
              onClose={() => setShowFilterPanel(false)}
              isMovie={isMovieForFilter}
              appliedFilters={activeFilters}
              appliedSortBy={activeSortBy}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
            />
          )}

          <Suspense fallback={<div />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/movies" replace />} />
              <Route
                path="/movies"
                element={
                  <ErrorBoundary>
                    <HomePage tab="movies" externalFilters={activeFilters} externalSortBy={activeSortBy} />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tv"
                element={
                  <ErrorBoundary>
                    <HomePage tab="tv" externalFilters={activeFilters} externalSortBy={activeSortBy} />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/anime"
                element={
                  <ErrorBoundary>
                    <AnimePage
                      externalFilters={activeFilters}
                      externalSortBy={activeSortBy}
                      onMediaTypeChange={setAnimeMediaType}
                    />
                  </ErrorBoundary>
                }
              />
              <Route path="/movie/:id" element={<ErrorBoundary><MovieDetailPage /></ErrorBoundary>} />
              <Route path="/tv/:id" element={<ErrorBoundary><TVDetailPage /></ErrorBoundary>} />
              <Route path="/person/:id" element={<ErrorBoundary><PersonPage /></ErrorBoundary>} />
              <Route path="/lists/:id" element={<ErrorBoundary><ListDetailPage /></ErrorBoundary>} />
              <Route path="/people" element={<ErrorBoundary><PeoplePage /></ErrorBoundary>} />
              <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
              <Route path="/tmdb-callback" element={<TMDBCallbackPage />} />
              <Route path="/watchlist" element={<ErrorBoundary><WatchlistPage /></ErrorBoundary>} />
              <Route path="/watched" element={<ErrorBoundary><WatchedPage /></ErrorBoundary>} />
              <Route path="/recommendations" element={<ErrorBoundary><RecommendationsPage /></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary><CalendarPage /></ErrorBoundary>} />
              <Route path="/lists" element={<ErrorBoundary><ListsPage /></ErrorBoundary>} />
              <Route path="/stats" element={<ErrorBoundary><StatsPage /></ErrorBoundary>} />              <Route path="/following" element={<ErrorBoundary><FollowingPage /></ErrorBoundary>} />
              <Route path="*" element={<Navigate to="/movies" replace />} />
            </Routes>
          </AnimatePresence>
          </Suspense>
        </main>

        {isAuthenticated && <BottomNav />}
      </div>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return <AppInner />;
}

export default App;
