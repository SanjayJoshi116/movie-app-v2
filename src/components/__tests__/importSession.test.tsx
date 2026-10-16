import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userApi, { bindSessionUser } from "../../api/userApi";
import CSVUploadModal from "../CSVUploadModal";
import CSVListImportModal from "../lists/CSVListImportModal";
import CSVImportAllModal from "../lists/CSVImportAllModal";
import { lookupImportPosters } from "../../utils/importPosters";
import type { BackupContents } from "../../utils/backup";
import { personLabel } from "../../utils/personLabel";
import { parseBackupCSV } from "../../utils/csvParse";
import { fetchMoviePoster } from "../../api/tmdb";
import { resetPacer } from "../../utils/pacedLookup";

// data-backup: an import ends with the session that started it, and its
// dialog can't be closed while it runs.

// antd modals with a table render slowly under jsdom.
jest.setTimeout(30_000);
/** Under the full suite's load these dialogs can take seconds to settle. */
const SLOW = { timeout: 10_000 };

const mockToast = { showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn() };
jest.mock("../../hooks/useToast", () => ({ useToast: () => mockToast }));

const mockApp = {
  reloadWatched: jest.fn(async () => undefined),
  reloadWatchlist: jest.fn(async () => undefined),
  reloadRatings: jest.fn(async () => undefined),
};
jest.mock("../../context/useAppContext", () => ({ useAppContext: () => mockApp }));

const mockLists = { lists: [{ id: 7, name: "Faves", items: [] }], reloadLists: jest.fn(async () => undefined), createList: jest.fn() };
jest.mock("../../context/useListsContext", () => ({ useListsContext: () => mockLists }));

jest.mock("../../utils/importPosters", () => ({
  ...jest.requireActual("../../utils/importPosters"),
  lookupImportPosters: jest.fn(),
}));
const lookup = lookupImportPosters as jest.MockedFunction<typeof lookupImportPosters>;
const realLookup = (jest.requireActual("../../utils/importPosters") as typeof import("../../utils/importPosters"))
  .lookupImportPosters;

jest.mock("../../api/tmdb", () => ({ __esModule: true, fetchMoviePoster: jest.fn(), fetchTVPoster: jest.fn() }));
const moviePoster = fetchMoviePoster as jest.Mock;

const mockBackup: BackupContents = {
  version: 3,
  watchlist: [{ mediaId: 1, type: "movie", title: "A", posterPath: null, voteAverage: 7 }],
  watched: [{ mediaId: 2, type: "movie", title: "B", posterPath: null, voteAverage: 7 }],
  ratings: [],
  lists: [{ name: "Faves", entries: [{ mediaId: 3, type: "movie", title: "C", posterPath: null, voteAverage: 7 }] }],
  followed: [{ personId: 287, name: "Brad Pitt", profilePath: null }],
  episodeProgress: [],
} as unknown as BackupContents;
// Plain functions, not jest.fn(impl): CRA's resetMocks clears those before each test.
jest.mock("jszip", () => ({ __esModule: true, default: { loadAsync: async () => ({}) } }));
jest.mock("../../utils/backup", () => ({
  ...jest.requireActual("../../utils/backup"),
  checkBackupFileSize: () => undefined,
  checkBackupZipSize: () => undefined,
  readBackupZip: async () => mockBackup,
}));

const CSV = "id,title\n550,Fight Club\n13,Forrest Gump\n";

/** Lookups that resolve only when the test says so, to sign out in between. */
function pendingLookups() {
  let finish: () => void = () => undefined;
  lookup.mockImplementation(
    (rows) => new Promise((resolve) => {
      finish = () => resolve({ found: rows.map(() => ({ posterPath: "/p.jpg", voteAverage: 7 })), missing: 0 });
    }),
  );
  return () => finish();
}

async function pickFile(name: string, content: string) {
  const input = screen.getByLabelText(/file to import/i);
  fireEvent.change(input, { target: { files: [new File([content], name)] } });
}

beforeAll(() => {
  // antd's Table reads it; jsdom doesn't have it.
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

let post: jest.SpyInstance;
beforeEach(() => {
  for (const f of [mockApp.reloadWatched, mockApp.reloadWatchlist, mockApp.reloadRatings, mockLists.reloadLists]) {
    f.mockResolvedValue(undefined);
  }
  bindSessionUser(1);
  post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => (
    { data: { added: (body as { entries?: unknown[] })?.entries?.length ?? 0, skipped: 0 } } as never
  ));
});
afterEach(() => {
  post.mockRestore();
  bindSessionUser(null);
});

describe.each([
  ["watched CSV", () => <CSVUploadModal open onClose={jest.fn()} />, "Fight Club"],
  ["list CSV", () => <CSVListImportModal open onClose={jest.fn()} lockedListId={7} />, "Fight Club"],
])("%s import", (_label, renderModal, previewText) => {
  async function startImport() {
    const finish = pendingLookups();
    render(renderModal());
    await pickFile("rows.csv", CSV);
    await screen.findAllByText(previewText, {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    await waitFor(() => expect(lookup).toHaveBeenCalled(), SLOW);
    return finish;
  }

  it("writes nothing and shows nothing after a sign-out mid-import", async () => {
    const finish = await startImport();
    act(() => bindSessionUser(2)); // signed out, and in as someone else, in this tab
    await act(async () => finish());

    expect(post).not.toHaveBeenCalled();
    expect(mockToast.showSuccess).not.toHaveBeenCalled();
    expect(mockToast.showError).not.toHaveBeenCalled();
    expect(mockToast.showInfo).not.toHaveBeenCalled();
  });

  it("changes no dialog state when the lookups end after a sign-out", async () => {
    let finish: () => void = () => undefined;
    lookup.mockImplementation((rows, onProgress) => new Promise((resolve) => {
      onProgress?.(1, rows.length);
      finish = () => resolve({ found: rows.map(() => ({ posterPath: "/p.jpg", voteAverage: 7 })), missing: 0 });
    }));
    render(renderModal());
    await pickFile("rows.csv", CSV);
    await screen.findAllByText(previewText, {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    expect(await screen.findByText("Looking up posters: 1 / 2", {}, SLOW)).toBeInTheDocument();
    act(() => bindSessionUser(2));
    await act(async () => finish());

    // The progress line was never cleared: nothing ran after the lookups.
    expect(screen.getByText("Looking up posters: 1 / 2")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("stops its lookups once the session has ended", async () => {
    await startImport();
    const shouldStop = lookup.mock.calls[0]![2]!;
    expect(shouldStop()).toBe(false);
    bindSessionUser(2);
    expect(shouldStop()).toBe(true);
  });

  it("can't be closed while running, and can once it finishes", async () => {
    const finish = await startImport();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => finish());
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), SLOW);
  });
});

describe.each([
  ["watched CSV", () => <CSVUploadModal open onClose={jest.fn()} />],
  ["list CSV", () => <CSVListImportModal open onClose={jest.fn()} lockedListId={7} />],
])("%s file that can't be read", (_label, renderModal) => {
  it("says so instead of showing nothing", async () => {
    const read = jest.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (this: FileReader) {
      this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
    });
    render(renderModal());
    await pickFile("rows.csv", CSV);
    expect(await screen.findByText("Couldn't read that file.", {}, SLOW)).toBeInTheDocument();
    read.mockRestore();
  });
});

describe("watched CSV import keeps the export's extra columns", () => {
  it("sends runtime and platform, and prefers the row's poster", async () => {
    // The final values per row (lookupImportPosters keeps the file's poster).
    lookup.mockResolvedValue({ found: [{ posterPath: "/own.jpg", voteAverage: 8 }, { posterPath: "/lookup2.jpg", voteAverage: 6 }], missing: 0 });
    render(<CSVUploadModal open onClose={jest.fn()} />);
    await pickFile("watched.csv",
      "title,type,tmdb_id,watched_at,runtime_minutes,platform,poster_path\n" +
      "Fight Club,movie,550,2024-01-02T10:00:00Z,139,Netflix,/own.jpg\n" +
      "Forrest Gump,movie,13,,,,\n");
    await screen.findAllByText("Fight Club", {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1), SLOW);
    const { entries } = post.mock.calls[0]![1] as { entries: Array<Record<string, unknown>> };
    expect(lookup.mock.calls[0]![0][0]).toMatchObject({ mediaId: 550, posterPath: "/own.jpg" });
    expect(entries[0]).toMatchObject({ mediaId: 550, runtimeMinutes: 139, platform: "Netflix", posterPath: "/own.jpg" });
    expect(entries[1]).toMatchObject({ mediaId: 13, posterPath: "/lookup2.jpg" });
    expect(entries[1]).not.toHaveProperty("runtimeMinutes");
    expect(entries[1]).not.toHaveProperty("platform");
  });
});

describe("backup restore", () => {
  async function startRestore() {
    const finish = pendingLookups();
    render(<CSVImportAllModal open onClose={jest.fn()} />);
    await pickFile("backup.zip", "zip");
    fireEvent.click(await screen.findByRole("button", { name: "Import All" }, SLOW));
    await waitFor(() => expect(lookup).toHaveBeenCalled(), SLOW);
    return finish;
  }

  it("sends no watchlist, watched, list or follow write after a sign-out mid-restore", async () => {
    const finish = await startRestore();
    act(() => bindSessionUser(2));
    await act(async () => finish());

    expect(post).not.toHaveBeenCalled();
    expect(mockLists.createList).not.toHaveBeenCalled();
    expect(mockApp.reloadWatchlist).not.toHaveBeenCalled();
    expect(mockToast.showSuccess).not.toHaveBeenCalled();
    expect(mockToast.showError).not.toHaveBeenCalled();
  });

  it("stops between sections when the session ends during one", async () => {
    const finish = await startRestore();
    post.mockImplementation(async (_url, body) => {
      bindSessionUser(2); // ends during the watchlist request
      return { data: { added: (body as { entries: unknown[] }).entries.length, skipped: 0 } } as never;
    });
    await act(async () => finish());

    expect(post.mock.calls.map(([url]) => url)).toEqual(["/watchlist/bulk/"]);
    expect(mockToast.showSuccess).not.toHaveBeenCalled();
  });

  it("counts a list it couldn't create as failed, even an empty one", async () => {
    const saved = mockBackup.lists;
    mockBackup.lists = [{ name: "Empty one", entries: [] }] as unknown as BackupContents["lists"];
    const get = jest.spyOn(userApi, "get").mockResolvedValue({ data: { results: [], next: null } } as never);
    mockLists.createList.mockRejectedValue(new Error("nope"));
    lookup.mockImplementation(async (rows) => ({ found: rows.map(() => ({ posterPath: null })), missing: rows.length }));
    try {
      render(<CSVImportAllModal open onClose={jest.fn()} />);
      await pickFile("backup.zip", "zip");
      fireEvent.click(await screen.findByRole("button", { name: "Import All" }, SLOW));
      expect(await screen.findByText(/Lists: .*1 list couldn't be created/, {}, SLOW)).toBeInTheDocument();
      expect(mockToast.showError).toHaveBeenCalledWith("Import finished with some failures. See the details.");
      expect(mockToast.showSuccess).not.toHaveBeenCalled();
    } finally {
      mockBackup.lists = saved;
      get.mockRestore();
    }
  });

  it("restores the valid ratings when one is out of range, without reporting a failure", async () => {
    const saved = mockBackup.ratings;
    // data-backup: a bad rating is dropped by the parser, not sent to fail the chunk.
    mockBackup.ratings = parseBackupCSV(
      "tmdb_id,title,type,user_rating,review\n550,Fight Club,movie,9,great\n13,Forrest Gump,movie,11,\n603,The Matrix,movie,7.5,\n",
    );
    lookup.mockImplementation(async (rows) => ({ found: rows.map(() => ({ posterPath: "/p.jpg" })), missing: 0 }));
    try {
      render(<CSVImportAllModal open onClose={jest.fn()} />);
      await pickFile("backup.zip", "zip");
      fireEvent.click(await screen.findByRole("button", { name: "Import All" }, SLOW));
      expect(await screen.findByText(/Ratings: 2 added/, {}, SLOW)).toBeInTheDocument();
      const ratingsCall = post.mock.calls.find(([url]) => url === "/ratings/bulk/");
      expect((ratingsCall![1] as { entries: { mediaId: number }[] }).entries.map((e) => e.mediaId)).toEqual([550, 603]);
      // (Other sections may fail here: the list mock creates nothing.)
      expect(screen.getByText(/Ratings: 2 added/).textContent).not.toMatch(/failed/);
    } finally {
      mockBackup.ratings = saved;
    }
  });

  it("can't be closed while running", async () => {
    await startRestore();
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });

  /** Restore `sections` through the real lookup over a mocked TMDB. */
  async function restoreWithRealLookup(sections: Partial<BackupContents>) {
    const saved = { ...mockBackup };
    Object.assign(mockBackup, { watchlist: [], watched: [], ratings: [], lists: [], followed: [], episodeProgress: [] }, sections);
    resetPacer();
    lookup.mockImplementation(realLookup);
    const get = jest.spyOn(userApi, "get").mockResolvedValue({ data: { results: [], next: null } } as never);
    mockLists.createList.mockImplementation(async (name: string) => ({ id: 70, name, items: [] }));
    try {
      render(<CSVImportAllModal open onClose={jest.fn()} />);
      await pickFile("backup.zip", "zip");
      fireEvent.click(await screen.findByRole("button", { name: "Import All" }, SLOW));
      await screen.findByText(/Watchlist: /, {}, SLOW);
    } finally {
      Object.assign(mockBackup, saved);
      get.mockRestore();
    }
  }

  // data-backup: a row looked up for its poster keeps TMDB's score when the backup's is 0.
  it("keeps the looked-up score for a poster-less row whose backup score is 0", async () => {
    moviePoster.mockResolvedValue({ data: { poster_path: "/t.jpg", vote_average: 7.8 } });
    await restoreWithRealLookup({
      watchlist: parseBackupCSV(
        "tmdb_id,title,type,vote_average,poster_path\n1,A,movie,,\n2,B,movie,6.5,\n3,C,movie,,/own.jpg\n",
      ),
    });
    expect(moviePoster.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    const call = post.mock.calls.find(([url]) => url === "/watchlist/bulk/");
    expect((call![1] as { entries: unknown[] }).entries).toEqual([
      expect.objectContaining({ mediaId: 1, posterPath: "/t.jpg", voteAverage: 7.8 }),
      expect.objectContaining({ mediaId: 2, posterPath: "/t.jpg", voteAverage: 6.5 }),
      expect.objectContaining({ mediaId: 3, posterPath: "/own.jpg", voteAverage: 0 }),
    ]);
  });

  // data-backup: one lookup per title, and the note counts titles.
  it("looks a title in several sections up once and counts it once", async () => {
    moviePoster.mockResolvedValue({ data: { poster_path: null, vote_average: 5 } });
    const row = () => ({ mediaId: 9, type: "movie", title: "Nine", posterPath: null, voteAverage: 0 });
    await restoreWithRealLookup({
      watchlist: [row()],
      watched: [row()],
      lists: [{ name: "One", entries: [row()] }, { name: "Two", entries: [row()] }],
    } as unknown as Partial<BackupContents>);
    expect(moviePoster).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/^1 saved without a poster/, {}, SLOW)).toBeInTheDocument();
  });
});

describe("backup dialog and followed people", () => {
  it("opening it doesn't start the lazy followed-people fetch", async () => {
    const userApiModule = jest.requireActual("../../api/userApi") as typeof import("../../api/userApi");
    const fetchFollowed = jest.spyOn(userApiModule, "getFollowedPeople").mockResolvedValue([]);
    const { AuthContext } = jest.requireActual("../../context/AuthContext") as typeof import("../../context/AuthContext");
    const { FollowedPeopleProvider } = jest.requireActual(
      "../../context/FollowedPeopleContext",
    ) as typeof import("../../context/FollowedPeopleContext");
    const auth = { isAuthenticated: true, isLoading: false, user: { id: 1 } } as unknown as React.ContextType<typeof AuthContext>;
    render(
      <AuthContext.Provider value={auth}>
        <FollowedPeopleProvider>
          <CSVImportAllModal open onClose={jest.fn()} />
        </FollowedPeopleProvider>
      </AuthContext.Provider>,
    );
    await screen.findByText(/Upload a CINE DB backup/, {}, SLOW);
    expect(fetchFollowed).not.toHaveBeenCalled();
    fetchFollowed.mockRestore();
  });
});

describe("personLabel", () => {
  it("falls back to Person <id> for a blank or whitespace name", () => {
    expect(personLabel("", 287)).toBe("Person 287");
    expect(personLabel("   ", 287)).toBe("Person 287");
    expect(personLabel(null, 287)).toBe("Person 287");
    expect(personLabel(" Brad Pitt ", 287)).toBe("Brad Pitt");
  });
});

