import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { RatingHabitItem, RatingHabits } from "../../api/userApi";
import { HotTakes, habitSentence } from "../HotTakes";

// watch-stats (rating-hot-takes): Hot takes on the Stats page.

const item = (over: Partial<RatingHabitItem> = {}): RatingHabitItem => ({
  mediaId: 1, mediaType: "movie", title: "Dune", posterPath: null, userRating: 9, tmdbRating: 5.2, gap: 3.8, ...over,
});

type Computed = Extract<RatingHabits, { avgOffset: number }>;
const habits = (over: Partial<Computed> = {}): RatingHabits => ({
  count: 8, minCount: 5, unratedCount: 2, avgOffset: 1.4, contrarianScore: 1.8, guiltyPleasures: [item()], notForYou: [], ...over,
});
const belowMinimum = (count: number, unratedCount = 4): RatingHabits => ({
  count, minCount: 5, unratedCount, avgOffset: null, contrarianScore: null, guiltyPleasures: [], notForYou: [],
});

// antd's Row/Col read matchMedia, which jsdom lacks.
beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

const show = (h: RatingHabits) => render(<MemoryRouter><HotTakes habits={h} /></MemoryRouter>);

describe("habitSentence", () => {
  it("says above, below or in line, with the ±0.2 band", () => {
    expect(habitSentence(1.4)).toBe("You rate 1.4 above TMDB on average");
    expect(habitSentence(-0.6)).toBe("You rate 0.6 below TMDB on average");
    expect(habitSentence(0.2)).toBe("You rate in line with TMDB on average");
    expect(habitSentence(-0.2)).toBe("You rate in line with TMDB on average");
    expect(habitSentence(0)).toBe("You rate in line with TMDB on average");
  });
});

describe("HotTakes", () => {
  it("shows the habit, the contrarian score and linked rows", () => {
    show(habits());
    expect(screen.getByText("You rate 1.4 above TMDB on average.")).toBeInTheDocument();
    expect(screen.getByText("1.8")).toBeInTheDocument();
    expect(screen.getByText("From 8 titles you watched and rated.")).toBeInTheDocument();
    const row = screen.getByRole("link", { name: "Dune: You 9 · TMDB 5.2" });
    expect(row).toHaveAttribute("href", "/movie/1");
  });

  it("says when a list has no titles", () => {
    show(habits());
    expect(screen.getByText(/nothing you rated 1.5 or more below TMDB/)).toBeInTheDocument();
  });

  it("shows half-point ratings as given and labels a blank title", () => {
    show(habits({ guiltyPleasures: [], notForYou: [item({ mediaId: 7, mediaType: "tv", title: " ", userRating: 3.5, tmdbRating: 8, gap: -4.5 })] }));
    expect(screen.getByRole("link", { name: "Untitled (#7): You 3.5 · TMDB 8.0" })).toHaveAttribute("href", "/tv/7");
  });

  it("below the minimum asks for more ratings and links to the rate page", () => {
    show(belowMinimum(3));
    expect(screen.getByText(/Rate 2 more watched titles to see your hot takes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rate your watched titles" })).toHaveAttribute("href", "/watched/rate");
    expect(screen.queryByText(/Contrarian score/)).toBeNull();
  });

  it("doesn't send to an empty rate page when every watched title is rated", () => {
    show(belowMinimum(3, 0));
    expect(screen.getByText(/Hot takes need 2 more watched titles with a TMDB score/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rate your watched titles" })).toBeNull();
  });

  it("uses the singular for one more title", () => {
    show(belowMinimum(4));
    expect(screen.getByText(/Rate 1 more watched title to see/)).toBeInTheDocument();
  });
});
