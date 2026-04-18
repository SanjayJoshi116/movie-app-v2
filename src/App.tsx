import React, { useState, Suspense, lazy } from "react";
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
import "./App.css";

const HomePage = lazy(() => import("./pages/HomePage"));
const MovieDetailPage = lazy(() => import("./pages/MovieDetailPage"));
const TVDetailPage = lazy(() => import("./pages/TVDetailPage"));
const PersonPage = lazy(() => import("./pages/PersonPage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const WatchedPage = lazy(() => import("./pages/WatchedPage"));
const AnimePage = lazy(() => import("./pages/AnimePage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ListsPage = lazy(() => import("./pages/ListsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TMDBCallbackPage = lazy(() => import("./pages/TMDBCallbackPage"));

function AppInner() {
  const location = useLocation();
  const { theme } = useAppContext();
  const { isAuthenticated, isLoading } = useAuth();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(null);
  const [activeSortBy, setActiveSortBy] = useState<SortOption>("popularity.desc");
  const [animeMediaType, setAnimeMediaType] = useState<"tv" | "movies">("tv");

  const PUBLIC_PATHS = ["/login", "/register"];
  if (!isLoading && !isAuthenticated && !PUBLIC_PATHS.includes(location.pathname)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isBrowsePage =
    location.pathname === "/movies" ||
    location.pathname === "/tv" ||
    location.pathname === "/anime";

  const isMovieForFilter =
    location.pathname === "/movies" ||
    (location.pathname === "/anime" && animeMediaType === "movies");

  const handleApplyFilters = (filters: FilterValues, sortBy: SortOption) => {
    setActiveFilters(filters);
    setActiveSortBy(sortBy);
    setShowFilterPanel(false);
  };

  const handleResetFilters = () => {
    setActiveFilters(null);
    setActiveSortBy("popularity.desc");
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
              open={showFilterPanel}
              onClose={() => setShowFilterPanel(false)}
              isMovie={isMovieForFilter}
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
              <Route path="/people" element={<ErrorBoundary><PeoplePage /></ErrorBoundary>} />
              <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/tmdb-callback" element={<TMDBCallbackPage />} />
              <Route path="/watchlist" element={<ErrorBoundary><WatchlistPage /></ErrorBoundary>} />
              <Route path="/watched" element={<ErrorBoundary><WatchedPage /></ErrorBoundary>} />
              <Route path="/recommendations" element={<ErrorBoundary><RecommendationsPage /></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary><CalendarPage /></ErrorBoundary>} />
              <Route path="/lists" element={<ErrorBoundary><ListsPage /></ErrorBoundary>} />
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
