import { useState, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ConfigProvider, App as AntApp } from "antd";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import { FilterPanel } from "./components/layout/FilterPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteAnnouncer from "./components/RouteAnnouncer";
import { useUIContext } from "./context/UIContext";
import { useAuth } from "./context/AuthContext";
import { darkThemeConfig, lightThemeConfig } from "./theme/antdTheme";
import type { FilterValues, SortOption } from "./types";
import { animeModeOf, browseScope, DEFAULT_SORT, type BrowseScope } from "./utils/browseFilters";
import { isAuthOnlyPath, isResetPasswordPath, postLoginPath, loginRedirectState } from "./utils/postLoginPath";
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
const RateQueuePage = lazy(() => import("./pages/RateQueuePage"));
const AnimePage = lazy(() => import("./pages/AnimePage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ListsPage = lazy(() => import("./pages/ListsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const FollowingPage = lazy(() => import("./pages/FollowingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const TMDBCallbackPage = lazy(() => import("./pages/TMDBCallbackPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function AppInner() {
  const location = useLocation();
  // UI context only: useAppContext() also subscribes to the watched/watchlist/
  // ratings contexts, which re-rendered the whole route tree on every change.
  const { theme } = useUIContext();
  const { isAuthenticated, isLoading, signedOutInThisTab } = useAuth();
  // The browse scope the filter drawer was opened on: it shows only there, so
  // leaving the browse pages (or switching scope) closes it without a reset.
  const [filterPanelScope, setFilterPanelScope] = useState<BrowseScope | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(null);
  const [activeSortBy, setActiveSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [activeGenres, setActiveGenres] = useState<number[]>([]);
  const [animeMediaType, setAnimeMediaType] = useState<"tv" | "movies">("tv");

  // A Back-restore of an Anime grid carries its mode in the saved category.
  // Adopt it during render, once per history entry, so the scope (and its
  // filter reset) matches the restored grid's first request, instead of
  // AnimePage's mount effect correcting it after a request in the other mode.
  const restore = location.state as { isReturn?: boolean; activeCategory?: string } | null;
  const [animeSyncedKey, setAnimeSyncedKey] = useState<string | null>(null);
  // History state is untyped data: a non-string category is ignored, never
  // passed on to a string method in the shell's render.
  if (
    location.pathname === "/anime" && restore?.isReturn && typeof restore.activeCategory === "string"
    && location.key !== animeSyncedKey
  ) {
    setAnimeSyncedKey(location.key);
    const restoredMode = animeModeOf(restore.activeCategory);
    if (restoredMode !== animeMediaType) setAnimeMediaType(restoredMode);
  }

  // Applied filters (genres included) belong to one browse media type. Off browse pages the
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
    setActiveGenres([]);
  }
  // Leaving or switching the scope closes the drawer for good, so coming back
  // (Back/Forward) doesn't reopen it unasked.
  if (filterPanelScope !== null && filterPanelScope !== filterScope) {
    setFilterPanelScope(null);
  }
  const showFilterPanel = filterScope !== null && filterPanelScope === filterScope;
  const setShowFilterPanel = (open: boolean) => setFilterPanelScope(open ? filterScope : null);
  const toggleFilterPanel = () => setShowFilterPanel(!showFilterPanel);

  // Applied filters, sort and the Anime mode end with the session, like UIContext's settings.
  const [filtersForSignedIn, setFiltersForSignedIn] = useState(isAuthenticated);
  if (filtersForSignedIn !== isAuthenticated) {
    setFiltersForSignedIn(isAuthenticated);
    if (!isAuthenticated) {
      setActiveFilters(null);
      setActiveSortBy(DEFAULT_SORT);
      setActiveGenres([]);
      setAnimeMediaType("tv");
      setFilterPanelScope(null);
    }
  }

  const onAuthOnlyPage = isAuthOnlyPath(location.pathname);
  // Reset links stay public and reachable when signed in (an emailed link must work).
  const isPublicPath = onAuthOnlyPage || isResetPasswordPath(location.pathname);
  if (!isLoading && !isAuthenticated && !isPublicPath) {
    return <Navigate to="/login" state={loginRedirectState(location, signedOutInThisTab)} replace />;
  }
  if (onAuthOnlyPage) {
    // Blank while the session restores, so a signed-in user never sees the form flash.
    if (isLoading) return null;
    // Same target LoginPage navigates to after signing in.
    if (isAuthenticated) return <Navigate to={postLoginPath(location.state)} replace />;
  }

  const isBrowsePage = filterScope !== null;
  const isMovieForFilter = filterScope === "movie" || filterScope === "anime-movies";

  const handleApplyFilters = (filters: FilterValues, sortBy: SortOption, genres: number[]) => {
    setActiveFilters(filters);
    setActiveSortBy(sortBy);
    setActiveGenres(genres);
    setShowFilterPanel(false);
  };

  const handleResetFilters = () => {
    setActiveFilters(null);
    setActiveSortBy(DEFAULT_SORT);
    setActiveGenres([]);
  };

  return (
    <ConfigProvider theme={theme === "dark" ? darkThemeConfig : lightThemeConfig}>
      <AntApp>
      <div className="app-shell">
        <RouteAnnouncer />
        {isAuthenticated && (
          <Sidebar
            isBrowsePage={isBrowsePage}
            showFilterPanel={showFilterPanel}
            onToggleFilterPanel={toggleFilterPanel}
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
              appliedGenres={activeGenres}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
            />
          )}

          <Suspense fallback={<div />}>
          <AnimatePresence mode="wait">
            {/* Keyed on the path: besides the page transition, this mounts a
                fresh detail/person page for each id, so the previous subject
                never shows (or titles the tab) under the new address. */}
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/movies" replace />} />
              <Route
                path="/movies"
                element={
                  <ErrorBoundary>
                    <HomePage tab="movies" externalFilters={activeFilters} externalSortBy={activeSortBy} externalGenres={activeGenres} />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tv"
                element={
                  <ErrorBoundary>
                    <HomePage tab="tv" externalFilters={activeFilters} externalSortBy={activeSortBy} externalGenres={activeGenres} />
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
                      externalGenres={activeGenres}
                      initialMode={animeMediaType}
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
              <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
              <Route path="/register" element={<ErrorBoundary><RegisterPage /></ErrorBoundary>} />
              <Route path="/forgot-password" element={<ErrorBoundary><ForgotPasswordPage /></ErrorBoundary>} />
              <Route path="/reset-password/:uid/:token" element={<ErrorBoundary><ResetPasswordPage /></ErrorBoundary>} />
              <Route path="/tmdb-callback" element={<ErrorBoundary><TMDBCallbackPage /></ErrorBoundary>} />
              <Route path="/watchlist" element={<ErrorBoundary><WatchlistPage /></ErrorBoundary>} />
              <Route path="/watched" element={<ErrorBoundary><WatchedPage /></ErrorBoundary>} />
              <Route path="/watched/rate" element={<ErrorBoundary><RateQueuePage /></ErrorBoundary>} />
              <Route path="/recommendations" element={<ErrorBoundary><RecommendationsPage /></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary><CalendarPage /></ErrorBoundary>} />
              <Route path="/lists" element={<ErrorBoundary><ListsPage /></ErrorBoundary>} />
              <Route path="/stats" element={<ErrorBoundary><StatsPage /></ErrorBoundary>} />
              <Route path="/following" element={<ErrorBoundary><FollowingPage /></ErrorBoundary>} />
              <Route path="*" element={<ErrorBoundary><NotFoundPage /></ErrorBoundary>} />
            </Routes>
          </AnimatePresence>
          </Suspense>
        </main>

        {isAuthenticated && (
          <BottomNav
            isBrowsePage={isBrowsePage}
            showFilterPanel={showFilterPanel}
            onToggleFilterPanel={toggleFilterPanel}
          />
        )}
      </div>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return <AppInner />;
}

export default App;
