import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  fetchFollowedPeopleRecommendations,
  fetchForYouRecommendations,
  fetchPersonalizedRecommendations,
} from "../../api/userApi";
import { useAppContext } from "../../context/useAppContext";
import RecommendationsPage from "../RecommendationsPage";

jest.mock("../../api/userApi", () => ({
  __esModule: true,
  fetchForYouRecommendations: jest.fn(),
  fetchPersonalizedRecommendations: jest.fn(),
  fetchFollowedPeopleRecommendations: jest.fn(),
  saveSessionCache: jest.fn(),
}));
jest.mock("../../context/useAppContext", () => ({ useAppContext: jest.fn() }));
const mockWatchlist = { isIn: jest.fn(() => false), add: jest.fn(), remove: jest.fn() };
const mockWatched = { isWatched: jest.fn(() => false), add: jest.fn(), remove: jest.fn(), toggle: jest.fn() };
jest.mock("../../context/WatchlistContext", () => ({ useWatchlistContext: () => mockWatchlist }));
jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: () => mockWatched }));
// The real dialog fetches TMDB details; this stand-in only confirms.
jest.mock("../../components/MarkWatchedModal", () => ({
  MarkWatchedModal: ({ open, onConfirm }: { open: boolean; onConfirm: (d: object) => Promise<void> }) =>
    open ? <button onClick={() => { onConfirm({ runtimeMinutes: 120 }).catch(() => {}); }}>Confirm watched</button> : null,
}));
jest.mock("../../hooks/useActionIconColor", () => ({ useActionIconColor: () => "black" }));
// The rate prompt has its own tests (RateQueuePrompt.test.tsx).
jest.mock("../../components/RateQueuePrompt", () => ({ RateQueuePrompt: () => null }));
jest.mock("../../hooks/useToast", () => {
  const toast = { showSuccess: jest.fn(), showError: jest.fn() };
  return { useToast: () => toast };
});

const mockForYou = fetchForYouRecommendations as jest.Mock;
const mockPersonalized = fetchPersonalizedRecommendations as jest.Mock;
const mockFollowed = fetchFollowedPeopleRecommendations as jest.Mock;
const mockApp = useAppContext as jest.Mock;

const section = (key: string, title: string) => ({
  key, label: `Because of ${key}`, items: [{ id: 1, type: "movie", title, posterPath: null, voteAverage: 7 }],
});
const watched = [{ id: 550, type: "movie", title: "Fight Club" }];
const appState = (over: Record<string, unknown> = {}) => ({
  watchedList: watched, isDataLoading: false, watchedError: null, reloadWatched: jest.fn().mockResolvedValue(undefined),
  ...over,
});

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  mockWatchlist.isIn.mockReturnValue(false);
  mockWatched.isWatched.mockReturnValue(false);
  mockWatchlist.add.mockResolvedValue(undefined);
  mockWatched.add.mockResolvedValue(undefined);
});

const renderPage = () => render(<MemoryRouter><RecommendationsPage /></MemoryRouter>);

it("keeps loaded groups and shows an inline error when another group fails", async () => {
  mockApp.mockReturnValue(appState());
  mockForYou.mockResolvedValue({ data: { status: "ready", sections: [section("a", "Se7en")] } });
  mockPersonalized.mockResolvedValue({ data: { status: "ready", sections: [] } });
  mockFollowed.mockRejectedValue(new Error("boom"));
  renderPage();
  expect(await screen.findByText("Some recommendations couldn't be loaded.")).toBeInTheDocument();
  expect(screen.getByText("Se7en")).toBeInTheDocument();
  expect(screen.queryByText("Couldn't load recommendations")).toBeNull();
});

it("still shows the computing state when a group fails while another is pending", async () => {
  mockApp.mockReturnValue(appState());
  mockForYou.mockResolvedValue({ data: { status: "ready", sections: [] } });
  mockPersonalized.mockResolvedValue({ data: { status: "pending", sections: [] } });
  mockFollowed.mockRejectedValue(new Error("boom"));
  renderPage();
  expect(await screen.findByText("Some recommendations couldn't be loaded.")).toBeInTheDocument();
  expect(screen.getByText(/Crunching your watch history/)).toBeInTheDocument();
});

it("shows the load error, not the computing state, when no result is available", async () => {
  mockApp.mockReturnValue(appState());
  mockForYou.mockResolvedValue({ data: { status: "unavailable", sections: [] } });
  mockPersonalized.mockResolvedValue({ data: { status: "unavailable", sections: [] } });
  mockFollowed.mockResolvedValue({ data: [] });
  renderPage();
  expect(await screen.findByText("Couldn't load recommendations")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  expect(screen.queryByText(/Crunching your watch history/)).toBeNull();
  expect(screen.queryByText("Recommendations are taking longer than usual.")).toBeNull();
  expect(mockForYou).toHaveBeenCalledTimes(1); // no polling
});

it("Retry refetches every group", async () => {
  mockApp.mockReturnValue(appState());
  mockForYou.mockResolvedValue({ data: { status: "ready", sections: [section("a", "Se7en")] } });
  mockPersonalized.mockResolvedValue({ data: { status: "ready", sections: [] } });
  mockFollowed.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ data: [] });
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await screen.findByText("Se7en");
  expect(mockFollowed).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Some recommendations couldn't be loaded.")).toBeNull();
});

it("shows an error, not the empty state, when the watched history failed to load", () => {
  const state = appState({ watchedList: [], watchedError: new Error("down") });
  mockApp.mockReturnValue(state);
  renderPage();
  expect(screen.getByText("Couldn't load your watched titles")).toBeInTheDocument();
  expect(screen.queryByText(/No watched titles yet/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
  expect(state.reloadWatched).toHaveBeenCalled();
});

// write-feedback: card buttons run the action they show, never a toggle.
describe("card writes", () => {
  const readyWith = (title: string) => {
    mockApp.mockReturnValue(appState());
    mockForYou.mockResolvedValue({ data: { status: "ready", sections: [section("a", title)] } });
    mockPersonalized.mockResolvedValue({ data: { status: "ready", sections: [] } });
    mockFollowed.mockResolvedValue({ data: [] });
  };

  it("Add to watchlist adds, never toggles", async () => {
    readyWith("Se7en");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add to watchlist: Se7en" }));
    await waitFor(() => expect(mockWatchlist.add).toHaveBeenCalledTimes(1));
    expect(mockWatchlist.remove).not.toHaveBeenCalled();
  });

  it("confirming Mark as watched adds, never unmarks", async () => {
    readyWith("Se7en");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Mark as watched: Se7en" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm watched" }));
    await waitFor(() => expect(mockWatched.add).toHaveBeenCalledWith(expect.objectContaining({ id: 1, runtimeMinutes: 120 })));
    expect(mockWatched.remove).not.toHaveBeenCalled();
    expect(mockWatched.toggle).not.toHaveBeenCalled();
  });
});
