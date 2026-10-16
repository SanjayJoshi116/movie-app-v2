import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { fetchStats } from "../../api/userApi";
import StatsPage from "../StatsPage";

// accessibility spec: under reduced motion Stats' charts appear fully drawn.
// Recharts animates in JS, so each series has to be told.

jest.mock("framer-motion", () => ({ ...jest.requireActual("framer-motion"), useReducedMotion: jest.fn() }));
jest.mock("../../api/userApi", () => ({ __esModule: true, fetchStats: jest.fn() }));

// Every series records its animation flag; containers just render children
// (jsdom has no layout, so the real ResponsiveContainer would render nothing).
const mockSeries: { type: string; isAnimationActive?: boolean }[] = [];
jest.mock("recharts", () => {
  const pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const none = () => null;
  const series = (type: string) => (props: { isAnimationActive?: boolean }) => {
    mockSeries.push({ type, isAnimationActive: props.isAnimationActive });
    return null;
  };
  return {
    ResponsiveContainer: pass, BarChart: pass, PieChart: pass, AreaChart: pass,
    XAxis: none, YAxis: none, CartesianGrid: none, Tooltip: none, Legend: none, Cell: none,
    Bar: series("Bar"), Pie: series("Pie"), Area: series("Area"),
  };
});

const mockReduced = useReducedMotion as jest.Mock;

const stats = {
  totalWatched: 42, moviesCount: 30, tvCount: 12, totalRatings: 15, avgUserRating: 7.8, avgTmdbRating: 7.2,
  ratingDistribution: Array.from({ length: 10 }, (_, i) => ({ rating: String(i + 1), count: i })),
  monthlyActivity: [{ month: "Jan 2024", count: 5 }, { month: "Feb 2024", count: 8 }],
  topGenres: [{ genre: "Action", count: 10 }],
  languageBreakdown: [{ language: "en", count: 35 }],
  decadeBreakdown: [{ decade: "2010s", count: 20 }],
  dailyActivity: [{ date: "2024-01-15", count: 2 }],
  topRatedItems: [], recentItems: [],
  totalRuntimeMinutes: 5040,
  platformBreakdown: [{ platform: "Netflix", count: 12 }],
  ratingByGenre: [{ genre: "Drama", avgRating: 8.1 }],
  reviewsWritten: 4, listsCount: 2, listsItemsCount: 9, watchlistTotal: 6, watchlistUnwatched: 3,
};

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

beforeEach(() => {
  mockSeries.length = 0;
  (fetchStats as jest.Mock).mockResolvedValue({ data: stats });
});

async function seriesAfterLoad() {
  render(<MemoryRouter><StatsPage /></MemoryRouter>);
  await waitFor(() => expect(mockSeries.map((s) => s.type)).toEqual(expect.arrayContaining(["Pie", "Bar", "Area"])));
  return mockSeries;
}

it("draws every chart without animation under reduced motion", async () => {
  mockReduced.mockReturnValue(true);
  const series = await seriesAfterLoad();
  expect(series.every((s) => s.isAnimationActive === false)).toBe(true);
});

it("animates the charts when motion is allowed", async () => {
  mockReduced.mockReturnValue(false);
  const series = await seriesAfterLoad();
  expect(series.every((s) => s.isAnimationActive === true)).toBe(true);
});
