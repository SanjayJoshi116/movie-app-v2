import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useAppContext } from "../../context/useAppContext";
import { useWatchlistContext } from "../../context/WatchlistContext";
import { useWatchedContext } from "../../context/WatchedContext";
import type { WatchlistEntry } from "../../types";
import WatchlistPage from "../WatchlistPage";

// library-filters spec: the Watchlist's move to the last non-empty page waits
// for the data its active filter reads (the watched history).

jest.mock("framer-motion", () => ({ ...jest.requireActual("framer-motion"), useReducedMotion: jest.fn() }));
jest.mock("../../context/useAppContext", () => ({ useAppContext: jest.fn() }));
jest.mock("../../context/WatchlistContext", () => ({ useWatchlistContext: jest.fn() }));
jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: jest.fn() }));
jest.mock("../../hooks/useActionIconColor", () => ({ useActionIconColor: () => "#000000" }));
jest.mock("../../components/MarkWatchedModal", () => ({
  MarkWatchedModal: ({ open, onConfirm }: { open: boolean; onConfirm: (d: object) => Promise<void> }) =>
    open ? <button onClick={() => { onConfirm({ runtimeMinutes: 90 }).catch(() => {}); }}>Confirm watched</button> : null,
}));
jest.mock("../../components/SkeletonCard", () => ({ __esModule: true, default: () => <div data-testid="skeleton" /> }));
jest.mock("../../hooks/useToast", () => {
  const toast = { showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn(), showWarning: jest.fn() };
  return { useToast: () => toast };
});

// The dialog tests render antd's Modal, whose first render can pass 5 s on a busy machine.
jest.setTimeout(20_000);

const mockApp = useAppContext as jest.Mock;
const mockWatchlist = useWatchlistContext as jest.Mock;
const mockWatched = useWatchedContext as jest.Mock;

const addWatched = jest.fn().mockResolvedValue(undefined);
const removeWatched = jest.fn().mockResolvedValue(undefined);

const entries: WatchlistEntry[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1, type: "movie", title: `Title ${i + 1}`, posterPath: null, voteAverage: 7, addedAt: "2026-10-01T10:00:00Z",
}));

function setWatched(loaded: boolean) {
  mockApp.mockReturnValue({
    watchlist: entries,
    removeFromWatchlist: jest.fn(), clearAllWatchlist: jest.fn(),
    getRating: () => undefined, setRating: jest.fn(), removeRating: jest.fn(),
    isWatched: () => loaded,
  });
  mockWatchlist.mockReturnValue({ isLoading: false, hasLoaded: true, error: null, reload: jest.fn() });
  mockWatched.mockReturnValue({ isLoading: !loaded, hasLoaded: loaded, error: null, add: addWatched, remove: removeWatched });
}

function Probe() {
  return <div data-testid="search">{useLocation().search}</div>;
}

// A fresh element per render: rerendering the same one would be skipped.
const tree = () => (
  <MemoryRouter initialEntries={["/watchlist?page=3&pageSize=12"]}>
    <Routes>
      <Route path="/watchlist" element={<><WatchlistPage /><Probe /></>} />
    </Routes>
  </MemoryRouter>
);

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
  window.scrollTo = jest.fn();
});

beforeEach(() => sessionStorage.setItem("watchlist_watched_filter", "watched"));
afterEach(() => { sessionStorage.clear(); addWatched.mockClear(); removeWatched.mockClear(); });

it("keeps a deep-linked page while the watched history loads", () => {
  setWatched(false);
  const { rerender } = render(tree());
  expect(screen.getByTestId("search")).toHaveTextContent("page=3");

  setWatched(true);
  rerender(tree());
  expect(screen.getByTestId("search")).toHaveTextContent("page=3");
  expect(screen.getAllByText(/^Title \d+$/)).toHaveLength(6);
});

it("still clamps once the watched history has loaded", () => {
  setWatched(true);
  mockApp.mockReturnValue({ ...mockApp(), isWatched: (id: number) => id <= 5 });
  render(tree());
  expect(screen.getByTestId("search")).not.toHaveTextContent("page=3");
});

// accessibility spec: under reduced motion a page change jumps to the top.
it.each([[true, "auto"], [false, "smooth"]])("reduced motion %s: a page change scrolls with %s", (reduced, behavior) => {
  (useReducedMotion as jest.Mock).mockReturnValue(reduced);
  sessionStorage.setItem("watchlist_watched_filter", "all");
  setWatched(true);
  render(tree());
  (window.scrollTo as jest.Mock).mockClear();
  fireEvent.click(screen.getByTitle("2"));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior });
});

// load-states spec: a filter whose data failed shows that failure, not a made-up grid.
describe("watched filter with a failed watched history", () => {
  const reloadWatched = jest.fn();
  const setFailed = () => {
    setWatched(true);
    mockApp.mockReturnValue({ ...mockApp(), isWatched: () => false });
    mockWatched.mockReturnValue({ isLoading: false, hasLoaded: false, error: new Error("down"), reload: reloadWatched });
  };
  beforeEach(() => reloadWatched.mockReset().mockResolvedValue(undefined));

  it("shows the error with Retry instead of the filtered grid", () => {
    setFailed();
    render(tree());
    expect(screen.getByText("Couldn't load your watched history")).toBeInTheDocument();
    expect(screen.queryByText("No items match your filters.")).toBeNull();
    expect(screen.queryByText(/^Title \d+$/)).toBeNull();
    expect(screen.getByTestId("search")).toHaveTextContent("page=3");
  });

  it("shows the filtered grid on the address's page once Retry succeeds", () => {
    setFailed();
    const { rerender } = render(tree());
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(reloadWatched).toHaveBeenCalledTimes(1);

    setWatched(true);
    rerender(tree());
    expect(screen.queryByText("Couldn't load your watched history")).toBeNull();
    expect(screen.getByTestId("search")).toHaveTextContent("page=3");
    expect(screen.getAllByText(/^Title \d+$/)).toHaveLength(6);
  });

  it("shows the loading placeholder while Retry runs, and the error again if it fails", () => {
    setFailed();
    const { rerender } = render(tree());
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    mockWatched.mockReturnValue({ isLoading: true, hasLoaded: false, error: new Error("down"), reload: reloadWatched });
    rerender(tree());
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your watched history")).toBeNull();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();

    setFailed();
    rerender(tree());
    expect(screen.getByText("Couldn't load your watched history")).toBeInTheDocument();
    expect(reloadWatched).toHaveBeenCalledTimes(1);
  });

  it("shows the full grid when the filter is cleared", () => {
    setFailed();
    render(tree());
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(screen.queryByText("Couldn't load your watched history")).toBeNull();
    expect(screen.getAllByText(/^Title \d+$/).length).toBeGreaterThan(0);
  });
});

describe("watched filter while the watched history loads or reloads", () => {
  it("shows the loading placeholder, not a made-up grid, until the history arrives", () => {
    sessionStorage.setItem("watchlist_watched_filter", "unwatched");
    setWatched(false);
    mockApp.mockReturnValue({ ...mockApp(), isWatched: () => false });
    render(tree());
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/^Title \d+$/)).toBeNull();
    expect(screen.queryByText("No items match your filters.")).toBeNull();
  });

  // library-filters: the clamp waits for a reload in progress (an import may add titles).
  it("doesn't clamp while the watched history reloads, and does once it settles", () => {
    setWatched(true);
    mockApp.mockReturnValue({ ...mockApp(), isWatched: (id: number) => id <= 5 });
    mockWatched.mockReturnValue({ isLoading: true, hasLoaded: true, error: null });
    const { rerender } = render(tree());
    expect(screen.getByTestId("search")).toHaveTextContent("page=3");

    mockWatched.mockReturnValue({ isLoading: false, hasLoaded: true, error: null });
    rerender(tree());
    expect(screen.getByTestId("search")).not.toHaveTextContent("page=3");
  });

  it("keeps the filtered grid when a reload fails after a successful load", () => {
    setWatched(true);
    mockApp.mockReturnValue({ ...mockApp(), isWatched: (id: number) => id <= 3 });
    mockWatched.mockReturnValue({ isLoading: false, hasLoaded: true, error: new Error("down"), reload: jest.fn() });
    render(tree());
    expect(screen.queryByText("Couldn't load your watched history")).toBeNull();
    expect(screen.getAllByText(/^Title \d+$/)).toHaveLength(3);
  });
});

// data-backup spec: a title stored blank still names its card and buttons.
it("labels a blank-titled entry by its id, on the card and its buttons", () => {
  sessionStorage.setItem("watchlist_watched_filter", "all");
  setWatched(true);
  mockApp.mockReturnValue({
    ...mockApp(),
    watchlist: [{ id: 603, type: "movie", title: " ", posterPath: null, voteAverage: 0, addedAt: "2026-10-01T10:00:00Z" }],
    isWatched: () => false,
  });
  render(
    <MemoryRouter initialEntries={["/watchlist"]}>
      <WatchlistPage />
    </MemoryRouter>,
  );
  expect(screen.getByText("Untitled (#603)")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Untitled (#603)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove from watchlist: Untitled (#603)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mark watched: Untitled (#603)" })).toBeInTheDocument();
});

// write-feedback spec: the watched buttons run the action they show, never a toggle.
it("Unmark removes the title, never toggles", () => {
  sessionStorage.setItem("watchlist_watched_filter", "all");
  setWatched(true);
  mockApp.mockReturnValue({
    ...mockApp(),
    watchlist: [{ id: 603, type: "movie", title: "", posterPath: null, voteAverage: 0, addedAt: "2026-10-01T10:00:00Z" }],
    isWatched: () => true,
  });
  render(
    <MemoryRouter initialEntries={["/watchlist"]}>
      <WatchlistPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark unwatched: Untitled (#603)" }));
  expect(removeWatched).toHaveBeenCalledWith(603, "movie");
  expect(addWatched).not.toHaveBeenCalled();
});

it("confirming Mark watched adds with the fallback label, never unmarks", async () => {
  sessionStorage.setItem("watchlist_watched_filter", "all");
  setWatched(true);
  mockApp.mockReturnValue({
    ...mockApp(),
    watchlist: [{ id: 603, type: "movie", title: "", posterPath: null, voteAverage: 0, addedAt: "2026-10-01T10:00:00Z" }],
    isWatched: () => false,
  });
  render(
    <MemoryRouter initialEntries={["/watchlist"]}>
      <WatchlistPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark watched: Untitled (#603)" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm watched" }));
  await waitFor(() => expect(addWatched).toHaveBeenCalledWith(expect.objectContaining({ id: 603, title: "Untitled (#603)", runtimeMinutes: 90 })));
  expect(removeWatched).not.toHaveBeenCalled();
});

// library-filters: a failed watchlist reload that kept the list still clamps.
it("moves off an empty page after a failed reload that kept the list", () => {
  sessionStorage.setItem("watchlist_watched_filter", "all");
  setWatched(true);
  mockWatchlist.mockReturnValue({ isLoading: false, hasLoaded: true, error: new Error("502"), reload: jest.fn() });
  render(
    <MemoryRouter initialEntries={["/watchlist?page=5&pageSize=12"]}>
      <Routes>
        <Route path="/watchlist" element={<><WatchlistPage /><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByTestId("search")).toHaveTextContent("page=3");
});

// library-filters: an unknown saved watched filter reads as "All".
it("ignores an unknown saved watched filter", () => {
  sessionStorage.setItem("watchlist_watched_filter", "bogus");
  setWatched(true);
  mockApp.mockReturnValue({ ...mockApp(), isWatched: () => false });
  render(
    <MemoryRouter initialEntries={["/watchlist?pageSize=48"]}>
      <WatchlistPage />
    </MemoryRouter>,
  );
  expect(screen.getAllByText(/^Title \d+$/)).toHaveLength(30);
});

// The "Unwatched" filter follows the watched history even though isWatched
// keeps one identity (the real one reads a ref).
it("drops a title from Unwatched once it becomes watched", () => {
  sessionStorage.setItem("watchlist_watched_filter", "unwatched");
  const watchedIds = new Set<number>();
  const isWatched = (id: number) => watchedIds.has(id);
  setWatched(true);
  mockApp.mockReturnValue({ ...mockApp(), isWatched });
  const view = (list: object[]) => {
    mockWatched.mockReturnValue({ isLoading: false, hasLoaded: true, error: null, add: addWatched, remove: removeWatched, watchedList: list });
    return (
      <MemoryRouter initialEntries={["/watchlist?pageSize=48"]}>
        <WatchlistPage />
      </MemoryRouter>
    );
  };
  const { rerender } = render(view([]));
  expect(screen.getAllByText(/^Title \d+$/)).toHaveLength(30);
  watchedIds.add(1);
  rerender(view([{ id: 1, type: "movie" }]));
  expect(screen.getAllByText(/^Title \d+$/)).toHaveLength(29);
});
