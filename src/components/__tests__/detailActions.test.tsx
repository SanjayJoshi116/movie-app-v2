import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieDetails from "../MovieDetails";
import TVShowDetails from "../TVShowDetails";
import type { TMDBMovieDetail, TMDBTVDetail } from "../../types";

// fix-components-sweep-f4: the detail pages' watchlist button runs the action
// it shows, and episode tracking never offers an episode a season doesn't have.

jest.setTimeout(30_000);

const mockApp = { isInWatchlist: jest.fn(), getRating: jest.fn(), setRating: jest.fn(), removeRating: jest.fn() };
jest.mock("../../context/useAppContext", () => ({ useAppContext: () => mockApp }));
const mockWatchlist = { add: jest.fn(), remove: jest.fn() };
jest.mock("../../context/WatchlistContext", () => ({ useWatchlistContext: () => mockWatchlist }));
const mockWatched = { isWatched: jest.fn(), add: jest.fn(), remove: jest.fn() };
jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: () => mockWatched }));
const mockToast = { showSuccess: jest.fn(), showError: jest.fn() };
jest.mock("../../hooks/useToast", () => ({ useToast: () => mockToast }));
const mockEpisodes = {
  progress: null as null | { season: number; episode: number },
  loading: false, error: null, retry: jest.fn(), busy: false, update: jest.fn(), clear: jest.fn(),
};
jest.mock("../../hooks/useEpisodeProgress", () => ({ useEpisodeProgress: () => mockEpisodes }));
jest.mock("../../hooks/useActionIconColor", () => ({ useActionIconColor: () => "black" }));
jest.mock("../../hooks/useRegion", () => ({ useRegion: () => "US" }));
// Sections that fetch or aren't under test.
jest.mock("../EpisodeGuide", () => () => null);
jest.mock("../WatchProviders", () => ({ WatchProviders: () => null }));
jest.mock("../MediaCardGrid", () => ({ MediaCardGrid: () => null }));
jest.mock("../ReviewsSection", () => ({ ReviewsSection: () => null }));
jest.mock("../TrailerEmbed", () => ({ TrailerEmbed: () => null }));
jest.mock("../MarkWatchedModal", () => ({ MarkWatchedModal: () => null }));
jest.mock("../AddToListModal", () => ({ AddToListModal: () => null }));

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

beforeEach(() => {
  mockApp.isInWatchlist.mockReturnValue(false);
  mockApp.getRating.mockReturnValue(undefined);
  mockWatched.isWatched.mockReturnValue(false);
  mockWatchlist.add.mockResolvedValue(undefined);
  mockWatchlist.remove.mockResolvedValue(undefined);
  mockEpisodes.progress = null;
});

const movie = {
  id: 550, title: "Fight Club", poster_path: null, backdrop_path: null, vote_average: 8.4, genres: [],
  overview: "", release_date: "1999-10-15",
} as unknown as TMDBMovieDetail;

const show = {
  id: 1396, name: "Show", poster_path: null, backdrop_path: null, vote_average: 8, genres: [], overview: "",
  number_of_seasons: 5,
  seasons: [
    { season_number: 4, episode_count: 10 },
    { season_number: 5, episode_count: 0 }, // announced, no episodes yet
  ],
} as unknown as TMDBTVDetail;

const renderIn = (ui: JSX.Element) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("watchlist button", () => {
  it.each([
    ["movie", () => renderIn(<MovieDetails movie={movie} />), 550, "movie"],
    ["TV show", () => renderIn(<TVShowDetails tvShow={show} />), 1396, "tv"],
  ])("on a %s adds when it shows Add, never toggles", async (_label, renderPage, id, type) => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add to watchlist" }));
    await waitFor(() => expect(mockWatchlist.add).toHaveBeenCalledWith(expect.objectContaining({ id, type })));
    expect(mockWatchlist.remove).not.toHaveBeenCalled();
    expect(mockToast.showSuccess).toHaveBeenCalledWith("Added to watchlist");
  });

  it("removes when it shows Remove", async () => {
    mockApp.isInWatchlist.mockReturnValue(true);
    renderIn(<MovieDetails movie={movie} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove from watchlist" }));
    await waitFor(() => expect(mockWatchlist.remove).toHaveBeenCalledWith(550, "movie"));
    expect(mockWatchlist.add).not.toHaveBeenCalled();
    expect(mockToast.showSuccess).toHaveBeenCalledWith("Removed from watchlist");
  });
});

describe("episode tracking", () => {
  it("doesn't cap an announced season's episode at 0", () => {
    renderIn(<TVShowDetails tvShow={show} />);
    fireEvent.click(screen.getByRole("button", { name: "Track episode progress" }));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next season" }));
    fireEvent.click(screen.getByRole("button", { name: "Next episode" }));
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("/0")).toBeNull();
  });

  it("still caps a season with a known count", () => {
    renderIn(<TVShowDetails tvShow={show} />);
    fireEvent.click(screen.getByRole("button", { name: "Track episode progress" }));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Next season" }));
    expect(screen.getByText("/10")).toBeInTheDocument();
  });

  it("offers no Next Episode into a season with no episodes", () => {
    mockEpisodes.progress = { season: 4, episode: 10 };
    renderIn(<TVShowDetails tvShow={show} />);
    expect(screen.queryByRole("button", { name: /Next Episode/ })).toBeNull();
  });

  it("offers Next Episode within a season", () => {
    mockEpisodes.progress = { season: 4, episode: 3 };
    renderIn(<TVShowDetails tvShow={show} />);
    expect(screen.getByRole("button", { name: /Next Episode/ })).toBeInTheDocument();
  });
});
