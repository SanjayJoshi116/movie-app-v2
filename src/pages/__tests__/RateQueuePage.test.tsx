import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useWatchedContext } from "../../context/WatchedContext";
import { useRatingsContext } from "../../context/RatingsContext";
import type { RatingEntry, WatchedEntry } from "../../types";
import RateQueuePage from "../RateQueuePage";

// rating-queue spec: rate watched titles without a rating, one tap each.

jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: jest.fn() }));
jest.mock("../../context/RatingsContext", () => ({ useRatingsContext: jest.fn() }));
jest.mock("../../api/userApi", () => ({ currentSessionGeneration: () => 0, isCurrentSession: () => true }));
const mockShowError = jest.fn();
jest.mock("../../hooks/useToast", () => ({
  useToast: () => ({ showSuccess: jest.fn(), showError: mockShowError, showInfo: jest.fn(), showWarning: jest.fn() }),
}));

jest.setTimeout(20_000);

const mockWatched = useWatchedContext as jest.Mock;
const mockRatings = useRatingsContext as jest.Mock;

const w = (id: number, title: string, watchedAt: string, extra: Partial<WatchedEntry> = {}): WatchedEntry => ({
  id, type: "movie", title, posterPath: null, voteAverage: 7, watchedAt, watchedTz: "UTC", ...extra,
});

const HISTORY = [
  w(1, "Alien", "2026-01-01T12:00:00Z"),
  w(2, "Dune", "2026-03-01T12:00:00Z", { releaseYear: 2021 }),
  w(3, "Heat", "2026-02-01T12:00:00Z"),
];

let set: jest.Mock;
let remove: jest.Mock;
let watchedReload: jest.Mock;
let ratingsReload: jest.Mock;

function setup({
  history = HISTORY,
  rated = {} as Record<string, RatingEntry>,
  watchedState = { isLoading: false, hasLoaded: true, error: null as unknown },
  ratingsState = { isLoading: false, hasLoaded: true, error: null as unknown },
} = {}) {
  mockWatched.mockReturnValue({ watchedList: history, reload: watchedReload, ...watchedState });
  mockRatings.mockReturnValue({
    ratings: rated,
    get: (id: number, type: string) => rated[`${type}-${id}`] ?? null,
    set, remove, reload: ratingsReload, ...ratingsState,
  });
}

const tree = () => <MemoryRouter><RateQueuePage /></MemoryRouter>;
const currentTitle = () => screen.getByRole("heading", { level: 3 });
const rateButton = (title: string, n: number) => screen.getByRole("button", { name: `Rate ${title} ${n} out of 10` });

beforeEach(() => {
  set = jest.fn().mockResolvedValue(undefined);
  remove = jest.fn().mockResolvedValue(undefined);
  watchedReload = jest.fn().mockResolvedValue(undefined);
  ratingsReload = jest.fn().mockResolvedValue(undefined);
  mockShowError.mockClear();
});

it("offers unrated titles, newest watched first, with year and watch day", () => {
  setup({ rated: { "movie-3": { id: 3, type: "movie", title: "Heat", userRating: 8, review: "", ratedAt: "" } } });
  render(tree());
  expect(currentTitle()).toHaveTextContent("Dune (2021)");
  expect(screen.getByText(/watched 01-03-2026/)).toBeInTheDocument();
  expect(screen.getByText("0 rated · 2 left")).toBeInTheDocument();
  expect(document.title).toContain("Rate Watched Titles");
});

it("names a blank title Untitled (#id)", () => {
  setup({ history: [w(7, "  ", "2026-01-01T12:00:00Z")] });
  render(tree());
  expect(currentTitle()).toHaveTextContent("Untitled (#7)");
  expect(rateButton("Untitled (#7)", 5)).toBeInTheDocument();
});

it("a tap saves the score and moves on without waiting", async () => {
  let resolve!: () => void;
  set.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
  setup();
  render(tree());
  fireEvent.click(rateButton("Dune", 8));
  expect(set).toHaveBeenCalledWith(2, "movie", "Dune", 8);
  expect(currentTitle()).toHaveTextContent("Heat");
  expect(screen.getByText("0 rated · 2 left")).toBeInTheDocument(); // not counted until saved
  await act(async () => { resolve(); });
  expect(screen.getByText("1 rated · 2 left")).toBeInTheDocument();
});

it("a failed save shows the error and puts the title back first, uncounted", async () => {
  set.mockRejectedValueOnce(new Error("boom"));
  setup();
  render(tree());
  fireEvent.click(rateButton("Dune", 8));
  await waitFor(() => expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining("Dune")));
  expect(currentTitle()).toHaveTextContent("Dune");
  expect(screen.getByText("0 rated · 3 left")).toBeInTheDocument();
});

it("skip moves the title to the end", () => {
  setup();
  render(tree());
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(currentTitle()).toHaveTextContent("Heat");
  fireEvent.click(rateButton("Heat", 6));
  expect(currentTitle()).toHaveTextContent("Alien");
  fireEvent.click(rateButton("Alien", 6));
  expect(currentTitle()).toHaveTextContent("Dune");
});

it("undo is offered only after a save, and removes the last rating", async () => {
  setup();
  render(tree());
  expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
  fireEvent.click(rateButton("Dune", 8));
  const undo = await screen.findByRole("button", { name: /Undo last rating/ });
  fireEvent.click(undo);
  await waitFor(() => expect(remove).toHaveBeenCalledWith(2, "movie"));
  await waitFor(() => expect(currentTitle()).toHaveTextContent("Dune"));
  expect(screen.getByText("0 rated · 3 left")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
});

it("rates, skips and undoes from the keyboard, but not while typing", async () => {
  setup();
  render(
    <MemoryRouter>
      <input aria-label="other field" />
      <RateQueuePage />
    </MemoryRouter>,
  );
  fireEvent.keyDown(screen.getByLabelText("other field"), { key: "7" });
  expect(set).not.toHaveBeenCalled();

  fireEvent.keyDown(window, { key: "0" });
  expect(set).toHaveBeenCalledWith(2, "movie", "Dune", 10);
  await screen.findByText("1 rated · 2 left");
  fireEvent.keyDown(window, { key: "s" });
  expect(currentTitle()).toHaveTextContent("Alien");
  fireEvent.keyDown(window, { key: "1", ctrlKey: true });
  expect(set).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(window, { key: "u" });
  await waitFor(() => expect(remove).toHaveBeenCalledWith(2, "movie"));
});

it("drops a title rated elsewhere", () => {
  setup();
  const { rerender } = render(tree());
  expect(currentTitle()).toHaveTextContent("Dune");
  setup({ rated: { "movie-2": { id: 2, type: "movie", title: "Dune", userRating: 9, review: "", ratedAt: "" } } });
  rerender(tree());
  expect(currentTitle()).toHaveTextContent("Heat");
});

it("shows All caught up when nothing is unrated", () => {
  setup({ history: [] });
  render(tree());
  expect(screen.getByText("All caught up")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to Watched" })).toHaveAttribute("href", "/watched");
  expect(screen.queryByRole("button", { name: /out of 10/ })).toBeNull();
});

it("waits for both loads before building the queue", () => {
  setup({ ratingsState: { isLoading: true, hasLoaded: false, error: null } });
  render(tree());
  expect(screen.queryByText("All caught up")).toBeNull();
  expect(screen.queryByRole("button", { name: /out of 10/ })).toBeNull();
});

it("shows an error with Retry when the ratings failed to load", () => {
  setup({ ratingsState: { isLoading: false, hasLoaded: false, error: new Error("x") } });
  render(tree());
  expect(screen.queryByText("All caught up")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
  expect(ratingsReload).toHaveBeenCalled();
  expect(watchedReload).not.toHaveBeenCalled();
});

// Review fixes: one rating per key press, keys in an open dialog ignored, and
// Undo steps back in tap order whatever order the saves finish in.
it("ignores a held key's repeats", () => {
  setup();
  render(tree());
  fireEvent.keyDown(window, { key: "7" });
  fireEvent.keyDown(window, { key: "7", repeat: true });
  fireEvent.keyDown(window, { key: "7", repeat: true });
  expect(set).toHaveBeenCalledTimes(1);
  expect(currentTitle()).toHaveTextContent("Heat");
});

it("ignores keys pressed inside a dialog open over the page", () => {
  setup();
  render(
    <MemoryRouter>
      <div role="dialog"><button type="button">Dialog button</button></div>
      <RateQueuePage />
    </MemoryRouter>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Dialog button" }), { key: "3" });
  fireEvent.keyDown(screen.getByRole("button", { name: "Dialog button" }), { key: "s" });
  expect(set).not.toHaveBeenCalled();
  expect(currentTitle()).toHaveTextContent("Dune");
});

it("undoes the last title tapped, even when an earlier save finishes later", async () => {
  let finishDune!: () => void;
  set.mockReturnValueOnce(new Promise<void>((r) => { finishDune = r; })); // Dune: slow
  setup();
  render(tree());
  fireEvent.click(rateButton("Dune", 8));
  fireEvent.click(rateButton("Heat", 6)); // resolves at once
  await screen.findByText("1 rated · 1 left");
  await act(async () => { finishDune(); });
  expect(screen.getByText("2 rated · 1 left")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Undo last rating/ }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith(3, "movie")); // Heat, tapped last
});

it("keeps a save that finishes during an undo on the stack", async () => {
  let finishRemove!: () => void;
  remove.mockReturnValueOnce(new Promise<void>((r) => { finishRemove = r; }));
  setup();
  render(tree());
  fireEvent.click(rateButton("Dune", 8));
  const undo = await screen.findByRole("button", { name: /Undo last rating/ });
  fireEvent.click(undo); // removing Dune, still running
  fireEvent.click(rateButton("Heat", 6)); // saves meanwhile
  await screen.findByText("2 rated · 1 left");
  await act(async () => { finishRemove(); });
  // Dune's entry went, Heat's stayed.
  await waitFor(() => expect(screen.getByText(/1 rated · /)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /Undo last rating/ }));
  await waitFor(() => expect(remove).toHaveBeenLastCalledWith(3, "movie"));
});
