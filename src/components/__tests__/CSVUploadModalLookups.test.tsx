import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userApi, { bindSessionUser } from "../../api/userApi";
import CSVUploadModal from "../CSVUploadModal";
import CSVListImportModal from "../lists/CSVListImportModal";
import { fetchMoviePoster } from "../../api/tmdb";
import { resetPacer } from "../../utils/pacedLookup";

// data-backup: rows whose file gives both a poster and a score aren't looked
// up on TMDB, and the file's values beat the lookup's.

jest.setTimeout(30_000);
const SLOW = { timeout: 10_000 };

const mockToast = { showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn() };
jest.mock("../../hooks/useToast", () => ({ useToast: () => mockToast }));
const mockApp = { reloadWatched: jest.fn(async () => undefined) };
jest.mock("../../context/useAppContext", () => ({ useAppContext: () => mockApp }));
const mockLists = { lists: [{ id: 7, name: "Faves", items: [] }], reloadLists: jest.fn(async () => undefined), createList: jest.fn() };
jest.mock("../../context/useListsContext", () => ({ useListsContext: () => mockLists }));
jest.mock("../../api/tmdb", () => ({ __esModule: true, fetchMoviePoster: jest.fn(), fetchTVPoster: jest.fn() }));
const lookup = fetchMoviePoster as jest.Mock;

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

let post: jest.SpyInstance;
beforeEach(() => {
  mockApp.reloadWatched.mockResolvedValue(undefined);
  mockLists.reloadLists.mockResolvedValue(undefined);
  resetPacer();
  lookup.mockResolvedValue({ data: { poster_path: "/looked.jpg", vote_average: 5 } });
  bindSessionUser(1);
  post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => (
    { data: { added: (body as { entries?: unknown[] })?.entries?.length ?? 0, skipped: 0 } } as never
  ));
});
afterEach(() => {
  post.mockRestore();
  bindSessionUser(null);
});

async function importCSV(csv: string, modal: React.ReactElement = <CSVUploadModal open onClose={jest.fn()} />) {
  render(modal);
  fireEvent.change(screen.getByLabelText(/file to import/i), { target: { files: [new File([csv], "watched.csv")] } });
  await screen.findAllByText("Fight Club", {}, SLOW);
  fireEvent.click(screen.getByRole("button", { name: /import/i }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1), SLOW);
  return (post.mock.calls[0]![1] as { entries: { mediaId: number; posterPath: string | null; voteAverage?: number }[] }).entries;
}

it("makes no lookup when every row has a poster and a score", async () => {
  const entries = await importCSV(
    "title,type,tmdb_id,vote_average,poster_path\nFight Club,movie,550,8.4,/fc.jpg\nForrest Gump,movie,13,8.5,/fg.jpg\n",
  );
  expect(lookup).not.toHaveBeenCalled();
  expect(entries).toEqual([
    expect.objectContaining({ mediaId: 550, posterPath: "/fc.jpg", voteAverage: 8.4 }),
    expect.objectContaining({ mediaId: 13, posterPath: "/fg.jpg", voteAverage: 8.5 }),
  ]);
  await waitFor(() => expect(mockToast.showSuccess).toHaveBeenCalledWith(expect.not.stringMatching(/without a poster/)));
});

it("looks up only the rows missing a poster or a score, keeping the file's values", async () => {
  const entries = await importCSV(
    "title,type,tmdb_id,vote_average,poster_path\nFight Club,movie,550,8.4,/fc.jpg\nForrest Gump,movie,13,,/fg.jpg\nHeat,movie,949,7.9,\n",
  );
  expect(lookup).toHaveBeenCalledTimes(2);
  expect(lookup.mock.calls.map((c) => c[0]).sort()).toEqual([13, 949]);
  expect(entries).toEqual([
    expect.objectContaining({ mediaId: 550, posterPath: "/fc.jpg", voteAverage: 8.4 }),
    expect.objectContaining({ mediaId: 13, posterPath: "/fg.jpg", voteAverage: 5 }),
    expect.objectContaining({ mediaId: 949, posterPath: "/looked.jpg", voteAverage: 7.9 }),
  ]);
});

it("counts rows saved without a poster from the final values", async () => {
  lookup.mockRejectedValue(Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } }));
  await importCSV(
    "title,type,tmdb_id,vote_average,poster_path\nFight Club,movie,550,,/fc.jpg\nForrest Gump,movie,13,,\n",
  );
  await waitFor(() => expect(mockToast.showInfo).toHaveBeenCalledWith(expect.stringContaining("1 saved without a poster")));
});

describe("list CSV import", () => {
  const listModal = <CSVListImportModal open onClose={jest.fn()} lockedListId={7} />;

  it("makes no lookup for the Watched export and keeps the file's poster and score", async () => {
    const entries = await importCSV(
      "title,type,tmdb_id,vote_average,poster_path\nFight Club,movie,550,8.4,/fc.jpg\nForrest Gump,movie,13,8.5,/fg.jpg\n",
      listModal,
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ mediaId: 550, posterPath: "/fc.jpg", voteAverage: 8.4 }),
      expect.objectContaining({ mediaId: 13, posterPath: "/fg.jpg", voteAverage: 8.5 }),
    ]));
  });

  it("keeps the file's poster when that row's score lookup fails", async () => {
    lookup.mockRejectedValue(Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } }));
    const entries = await importCSV("title,type,tmdb_id,vote_average,poster_path\nFight Club,movie,550,,/fc.jpg\n", listModal);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(entries).toEqual([expect.objectContaining({ mediaId: 550, posterPath: "/fc.jpg", voteAverage: 0 })]);
  });
});
