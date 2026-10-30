import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MediaCard from "../MediaCard";
import type { MediaSummary } from "../../utils/mediaSummary";

// merge-media-cards: one card for movies and TV, same links and labels as the
// two cards it replaced.

const mockIsWatched = jest.fn(() => false);
const mockIsIn = jest.fn(() => false);
const mockWatched = { add: jest.fn(async () => undefined), remove: jest.fn(async () => undefined) };
const mockWatchlist = { add: jest.fn(async () => undefined), remove: jest.fn(async () => undefined) };
jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: () => ({ isWatched: mockIsWatched, ...mockWatched }) }));
jest.mock("../../context/WatchlistContext", () => ({ useWatchlistContext: () => ({ isIn: mockIsIn, ...mockWatchlist }) }));
jest.mock("../../hooks/useActionIconColor", () => ({ useActionIconColor: () => "currentColor" }));
jest.mock("../../hooks/useToast", () => ({ useToast: () => ({ showSuccess: () => undefined, showError: () => undefined }) }));
jest.mock("../MarkWatchedModal", () => ({
  MarkWatchedModal: ({ open, mediaId, mediaType }: { open: boolean; mediaId: number; mediaType: string }) =>
    open ? <div data-testid="mark-watched">{`${mediaType}:${mediaId}`}</div> : null,
}));

afterEach(() => {
  mockIsWatched.mockReturnValue(false);
  mockIsIn.mockReturnValue(false);
  jest.clearAllMocks();
});

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

const MOVIE: MediaSummary = { id: 550, type: "movie", title: "Fight Club", posterPath: "/fc.jpg", voteAverage: 8.4 };
const SHOW: MediaSummary = { id: 1396, type: "tv", title: "Breaking Bad", posterPath: null, voteAverage: 8.9 };

function renderCard(item: MediaSummary, onKnowMore = jest.fn()) {
  render(
    <MemoryRouter>
      <MediaCard {...item} onKnowMore={onKnowMore} />
    </MemoryRouter>,
  );
}

const poster = (title: string) => within(screen.getByRole("link", { name: title }));

it.each([
  { item: MOVIE, href: "/movie/550" },
  { item: SHOW, href: "/tv/1396" },
])("links the poster to $href", ({ item, href }) => {
  renderCard(item);
  expect(screen.getByRole("link", { name: item.title })).toHaveAttribute("href", href);
});

it.each([MOVIE, SHOW])("names $title in every action button", (item) => {
  const onKnowMore = jest.fn();
  renderCard(item, onKnowMore);
  expect(screen.getByRole("button", { name: `Mark as watched: ${item.title}` })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Add to watchlist: ${item.title}` })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `Know more about ${item.title}` }));
  expect(onKnowMore).toHaveBeenCalledWith(item.id, item.type);
});

it("names the unmark and remove actions once the title is in both lists", () => {
  mockIsWatched.mockReturnValue(true);
  mockIsIn.mockReturnValue(true);
  renderCard(SHOW);
  expect(screen.getByRole("button", { name: "Unmark watched: Breaking Bad" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove from watchlist: Breaking Bad" })).toBeInTheDocument();
});

it.each([MOVIE, SHOW])("opens Mark as Watched for $type $id", (item) => {
  renderCard(item);
  fireEvent.click(screen.getByRole("button", { name: `Mark as watched: ${item.title}` }));
  expect(screen.getByTestId("mark-watched")).toHaveTextContent(`${item.type}:${item.id}`);
});

it("shows the placeholder without a poster", () => {
  renderCard(SHOW);
  expect(poster("Breaking Bad").getByText("No Image")).toBeInTheDocument();
  expect(poster("Breaking Bad").queryByRole("presentation")).toBeNull();
});

it("shows the poster image when there is one", () => {
  renderCard(MOVIE);
  expect(poster("Fight Club").getByRole("presentation")).toHaveAttribute("src", expect.stringContaining("/fc.jpg"));
  expect(poster("Fight Club").getByRole("presentation")).toHaveClass("movie-poster-img");
  expect(screen.queryByText("No Image")).toBeNull();
});

// Explicit add/remove: a card never flips a title the other way than it says.
it("unmarks with remove, never an add", async () => {
  mockIsWatched.mockReturnValue(true);
  renderCard(MOVIE);
  fireEvent.click(screen.getByRole("button", { name: "Unmark watched: Fight Club" }));
  await waitFor(() => expect(mockWatched.remove).toHaveBeenCalledWith(550, "movie"));
  expect(mockWatched.add).not.toHaveBeenCalled();
});

it.each([
  { inList: false, call: "add" as const },
  { inList: true, call: "remove" as const },
])("watchlist button calls $call when inList is $inList", async ({ inList, call }) => {
  mockIsIn.mockReturnValue(inList);
  renderCard(SHOW);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`watchlist: Breaking Bad$`) }));
  await waitFor(() => expect(mockWatchlist[call]).toHaveBeenCalledTimes(1));
  expect(mockWatchlist[call === "add" ? "remove" : "add"]).not.toHaveBeenCalled();
});
