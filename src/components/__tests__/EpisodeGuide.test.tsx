import { act, fireEvent, render, screen, within } from "@testing-library/react";
import EpisodeGuide from "../EpisodeGuide";
import { fetchTVSeason } from "../../api/tmdb";
import type { TMDBTVSeason, TMDBSeasonDetail } from "../../types";

jest.mock("../../api/tmdb", () => ({ __esModule: true, fetchTVSeason: jest.fn() }));
const mockFetch = fetchTVSeason as jest.Mock;

// antd Collapse and Select renders are slow under a loaded jsdom run.
jest.setTimeout(20_000);

const seasons: TMDBTVSeason[] = [1, 2, 3].map((n) => ({
  id: n, name: `Season ${n}`, season_number: n, episode_count: 3, poster_path: null, air_date: null,
}));

const seasonDetail = (n: number): TMDBSeasonDetail => ({
  id: n, name: `Season ${n}`, season_number: n, poster_path: null, air_date: null,
  episodes: [1, 2, 3].map((e) => ({
    id: n * 100 + e, episode_number: e, name: `S${n} title ${e}`, overview: `S${n} plot ${e}`,
    air_date: "2020-01-01", runtime: 45, still_path: `/s${n}e${e}.jpg`, vote_average: 8,
  })),
});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockFetch.mockImplementation((_id: number, n: number) => Promise.resolve({ data: seasonDetail(n) }));
});

const at = (season: number, episode: number) => ({ season, episode });

async function openList() {
  fireEvent.click(await screen.findByText("3 episodes"));
}

/** Opens the season's episode list and every episode in it. */
async function expandAll() {
  await openList();
  screen.getAllByText(/^E\d$/).forEach((label) => fireEvent.click(label));
}

async function chooseSeason(n: number) {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  const options = await screen.findAllByTitle(`Season ${n} (3 eps)`);
  fireEvent.click(options[options.length - 1] as HTMLElement);
}

it("hides later episodes' title, overview and still, keeping the tracked one", async () => {
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(2, 2)} />);
  await expandAll();
  expect(screen.getByText("S2 title 2")).toBeInTheDocument();
  expect(screen.getByText("S2 plot 2")).toBeInTheDocument();
  expect(screen.queryByText("S2 title 3")).not.toBeInTheDocument();
  expect(screen.queryByText("S2 plot 3")).not.toBeInTheDocument();
  expect(screen.getByAltText("S2 title 2")).toBeInTheDocument();
  expect(screen.queryByAltText("S2 title 3")).not.toBeInTheDocument();
  expect(screen.getByText("Hidden to avoid spoilers")).toBeInTheDocument();
  expect(screen.getByText("Show details for episode 3")).toBeInTheDocument();
});

it("reveals one episode only, and the reveal survives a season switch", async () => {
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(2, 1)} />);
  await expandAll();
  fireEvent.click(screen.getByText("Show details for episode 2"));
  expect(screen.getByText("S2 title 2")).toBeInTheDocument();
  expect(screen.getByText("S2 plot 2")).toBeInTheDocument();
  expect(screen.queryByText("S2 title 3")).not.toBeInTheDocument();

  await chooseSeason(3);
  expect(await screen.findByText("3 episodes")).toBeInTheDocument();
  await chooseSeason(2);
  await openList();
  expect(screen.getByText("S2 title 2")).toBeInTheDocument();
  expect(screen.queryByText("S2 title 3")).not.toBeInTheDocument();
});

it("turning the switch off shows everything and is remembered on the device", async () => {
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(1, 1)} />);
  await openList();
  expect(screen.queryByText("S1 title 3")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.getByText("S1 title 3")).toBeInTheDocument();
  expect(window.localStorage.getItem("cinedb_spoiler_shield")).toBe("false");
});

it("starts from the remembered preference", async () => {
  window.localStorage.setItem("cinedb_spoiler_shield", JSON.stringify(false));
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(1, 1)} />);
  await openList();
  expect(screen.getByText("S1 title 3")).toBeInTheDocument();
  expect(screen.getByRole("switch")).not.toBeChecked();
});

it("shows no switch and hides nothing without progress", async () => {
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={null} />);
  await openList();
  expect(screen.getByText("S1 title 3")).toBeInTheDocument();
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});

it("doesn't shield a show marked watched", async () => {
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(1, 1)} watched />);
  await openList();
  expect(screen.getByText("S1 title 3")).toBeInTheDocument();
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});

it("shows no episode while progress loads, fetching the first season meanwhile", async () => {
  const { rerender } = render(<EpisodeGuide tvId={1} seasons={seasons} progressLoading />);
  expect(screen.getByRole("combobox")).toBeDisabled();
  // Season 1 is requested alongside the progress request, but not shown.
  expect(mockFetch).toHaveBeenCalledWith(1, 1);
  // Let that request land: it still must not show.
  await act(() => mockFetch.mock.results[0]?.value);
  expect(screen.queryByText("3 episodes")).not.toBeInTheDocument();
  rerender(<EpisodeGuide tvId={1} seasons={seasons} progress={at(2, 1)} />);
  await openList();
  expect(mockFetch).toHaveBeenLastCalledWith(1, 2);
  expect(screen.queryByText("S2 title 2")).not.toBeInTheDocument();
});

// A request still in flight is shared by the tmdb client's sharedGet.
it("shows the early first-season result without asking again", async () => {
  const { rerender } = render(<EpisodeGuide tvId={1} seasons={seasons} progressLoading />);
  await act(() => mockFetch.mock.results[0]?.value);
  rerender(<EpisodeGuide tvId={1} seasons={seasons} progress={null} />);
  await openList();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it("keeps the episode list while progress reloads (Retry)", async () => {
  const { rerender } = render(<EpisodeGuide tvId={1} seasons={seasons} progressError />);
  await openList();
  rerender(<EpisodeGuide tvId={1} seasons={seasons} progressLoading />);
  expect(screen.getByText("S1 title 3")).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toBeEnabled();
  rerender(<EpisodeGuide tvId={1} seasons={seasons} progress={at(1, 1)} />);
  expect(screen.queryByText("S1 title 3")).not.toBeInTheDocument();
});

it("shows episodes unhidden with a note when progress failed to load", async () => {
  render(<EpisodeGuide tvId={1} seasons={seasons} progressError />);
  expect(screen.getByText("Couldn't load your progress, so spoilers aren't hidden.")).toBeInTheDocument();
  await openList();
  expect(screen.getByText("S1 title 3")).toBeInTheDocument();
});

it("opens on the tracked season, else the first", async () => {
  const { unmount } = render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(3, 2)} />);
  await screen.findByText("3 episodes");
  expect(mockFetch).toHaveBeenLastCalledWith(1, 3);
  unmount();
  render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(9, 1)} />);
  await screen.findByText("3 episodes");
  expect(mockFetch).toHaveBeenLastCalledWith(1, 1);
});

it("a progress change re-applies the shield without switching the viewed season", async () => {
  const { rerender } = render(<EpisodeGuide tvId={1} seasons={seasons} progress={at(1, 1)} />);
  await openList();
  expect(screen.queryByText("S1 title 3")).not.toBeInTheDocument();
  rerender(<EpisodeGuide tvId={1} seasons={seasons} progress={at(2, 1)} />);
  expect(await screen.findByText("S1 title 3")).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(within(document.body).getByText("Season 1 (3 eps)")).toBeInTheDocument();
});
