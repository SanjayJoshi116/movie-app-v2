import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
jest.mock("../../context/WatchlistContext", () => ({ useWatchlistContext: () => ({ isIn: () => false, toggle: jest.fn() }) }));
jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: () => ({ isWatched: () => false, toggle: jest.fn() }) }));
jest.mock("../../hooks/useActionIconColor", () => ({ useActionIconColor: () => "black" }));
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
