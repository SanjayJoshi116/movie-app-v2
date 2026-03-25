import React, { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ConfigProvider } from "antd";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import { FilterPanel } from "./components/layout/FilterPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import MovieDetailPage from "./pages/MovieDetailPage";
import TVDetailPage from "./pages/TVDetailPage";
import PersonPage from "./pages/PersonPage";
import PeoplePage from "./pages/PeoplePage";
import WatchlistPage from "./pages/WatchlistPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import WatchedPage from "./pages/WatchedPage";
import AnimePage from "./pages/AnimePage";
import { useAppContext } from "./context/useAppContext";
import { darkThemeConfig, lightThemeConfig } from "./theme/antdTheme";
import type { FilterValues, SortOption } from "./types";
import "./App.css";

function AppInner() {
  const location = useLocation();
  const { theme } = useAppContext();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(null);
  const [activeSortBy, setActiveSortBy] = useState<SortOption>("popularity.desc");
  const [animeMediaType, setAnimeMediaType] = useState<"tv" | "movies">("tv");

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
      <div className="app-shell">
        <Sidebar
          isBrowsePage={isBrowsePage}
          showFilterPanel={showFilterPanel}
          onToggleFilterPanel={() => setShowFilterPanel((v) => !v)}
        />

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
              <Route path="/watchlist" element={<ErrorBoundary><WatchlistPage /></ErrorBoundary>} />
              <Route path="/watched" element={<ErrorBoundary><WatchedPage /></ErrorBoundary>} />
              <Route path="/recommendations" element={<ErrorBoundary><RecommendationsPage /></ErrorBoundary>} />
              <Route path="*" element={<Navigate to="/movies" replace />} />
            </Routes>
          </AnimatePresence>
        </main>

        <BottomNav />
      </div>
    </ConfigProvider>
  );
}

function App() {
  return <AppInner />;
}

export default App;
