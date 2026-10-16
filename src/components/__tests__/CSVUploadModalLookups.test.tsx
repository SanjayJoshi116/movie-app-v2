import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userApi, { bindSessionUser } from "../../api/userApi";
import CSVUploadModal from "../CSVUploadModal";
import { lookupImportPosters } from "../../utils/importPosters";

// data-backup: rows whose file gives both a poster and a score aren't looked
// up on TMDB, and the file's values beat the lookup's.

jest.setTimeout(30_000);
const SLOW = { timeout: 10_000 };

const mockToast = { showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn() };
jest.mock("../../hooks/useToast", () => ({ useToast: () => mockToast }));
const mockApp = { reloadWatched: jest.fn(async () => undefined) };
jest.mock("../../context/useAppContext", () => ({ useAppContext: () => mockApp }));
jest.mock("../../utils/importPosters", () => ({
  ...jest.requireActual("../../utils/importPosters"),
  lookupImportPosters: jest.fn(),
}));
const lookup = lookupImportPosters as jest.MockedFunction<typeof lookupImportPosters>;

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

let post: jest.SpyInstance;
beforeEach(() => {
  mockApp.reloadWatched.mockResolvedValue(undefined);
  lookup.mockImplementation(async (rows) => ({ found: rows.map(() => ({ posterPath: "/looked.jpg", voteAverage: 5 })), missing: 0 }));
  bindSessionUser(1);
  post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => (
    { data: { added: (body as { entries?: unknown[] })?.entries?.length ?? 0, skipped: 0 } } as never
  ));
});
afterEach(() => {
  post.mockRestore();
  bindSessionUser(null);
});

async function importCSV(csv: string) {
  render(<CSVUploadModal open onClose={jest.fn()} />);
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
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(lookup.mock.calls[0]![0]).toEqual([{ mediaId: 13, type: "movie" }, { mediaId: 949, type: "movie" }]);
  expect(entries).toEqual([
    expect.objectContaining({ mediaId: 550, posterPath: "/fc.jpg", voteAverage: 8.4 }),
    expect.objectContaining({ mediaId: 13, posterPath: "/fg.jpg", voteAverage: 5 }),
    expect.objectContaining({ mediaId: 949, posterPath: "/looked.jpg", voteAverage: 7.9 }),
  ]);
});

it("counts rows saved without a poster from the final values", async () => {
  lookup.mockImplementation(async (rows) => ({ found: rows.map(() => undefined), missing: rows.length }));
  await importCSV(
    "title,type,tmdb_id,vote_average,poster_path\nFight Club,movie,550,,/fc.jpg\nForrest Gump,movie,13,,\n",
  );
  await waitFor(() => expect(mockToast.showInfo).toHaveBeenCalledWith(expect.stringContaining("1 saved without a poster")));
});
