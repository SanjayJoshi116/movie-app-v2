import type { Page, Route } from "@playwright/test";
import { test, expect, mockAuthedBase, paginated } from "./fixtures";
import { buildBackupZip, type BackupSocial } from "../src/utils/backup";
import type { UserListDTO, WatchlistEntry, WatchedEntry, UserList, WatchlistEntryDTO } from "../src/types/domain";

// data-backup spec, driven through the dialogs' real file inputs. Backups are
// built with the app's own exporter, so the fixtures can't drift from it.
// The server mocks keep a little state: like bulk_import(), they only create,
// and answer {added, skipped, ignored, overLimit} by whether an entry was already there.

const FIGHT_CLUB: WatchlistEntry = {
  id: 550, type: "movie", title: "Fight Club", posterPath: null, voteAverage: 8.4, addedAt: "2024-01-15T10:00:00Z",
};
const BREAKING_BAD: WatchedEntry = {
  id: 1396, type: "tv", title: "Breaking Bad", posterPath: null, voteAverage: 8.9,
  watchedAt: "2024-02-01T20:00:00Z", watchedTz: "Europe/London", runtimeMinutes: 47, platform: "Netflix",
};
const FAVES: UserList = {
  id: 9, name: "Faves", description: "Best ones", createdAt: "2024-03-01T10:00:00Z",
  items: [{ ...FIGHT_CLUB, addedAt: "2024-03-02T10:00:00Z" }],
};

async function backupFile(lists: UserList[] = [FAVES], social?: BackupSocial) {
  const zip = buildBackupZip([FIGHT_CLUB], [BREAKING_BAD], [], lists, "2024-04-01T00:00:00Z", social);
  return { name: "cinedb-backup.zip", mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }) };
}

type Entry = { mediaId: number; mediaType: string };
const key = (e: Entry) => `${e.mediaType}-${e.mediaId}`;

/** A create-only server for the bulk endpoints and lists. */
function mockImportServer(page: Page, opts: { failWatchlistBulk?: boolean; failWatchedReloadAfterImport?: boolean } = {}) {
  const created = { watchlist: new Set<string>(), watched: new Set<string>(), ratings: new Set<string>() };
  const lists: UserListDTO[] = [];
  const listItems = new Map<number, Set<string>>();
  const sent = { bulk: [] as string[], listCreates: 0, watchedBodies: [] as Entry[][] };
  let nextListId = 40;

  const bulk = (set: Set<string>, route: Route) => {
    const entries: Entry[] = route.request().postDataJSON().entries;
    let added = 0;
    for (const e of entries) if (!set.has(key(e))) { set.add(key(e)); added++; }
    return route.fulfill({ json: { added, skipped: entries.length - added, ignored: 0, overLimit: 0 } });
  };

  const ready = (async () => {
    for (const kind of ["watchlist", "watched", "ratings"] as const) {
      await page.route(`**/api/${kind}/**`, (route) => {
        const req = route.request();
        if (req.method() === "POST" && req.url().includes(`/${kind}/bulk/`)) {
          sent.bulk.push(kind);
          if (kind === "watched") sent.watchedBodies.push(req.postDataJSON().entries);
          if (kind === "watchlist" && opts.failWatchlistBulk) return route.fulfill({ status: 500, json: {} });
          return bulk(created[kind], route);
        }
        if (kind === "watched" && opts.failWatchedReloadAfterImport && sent.bulk.includes("watched")) {
          return route.fulfill({ status: 500, json: {} });
        }
        if (kind === "watchlist") return route.fulfill({ json: paginated([LOADED_WATCHLIST_ITEM]) });
        return route.fulfill({ json: paginated([]) });
      });
    }
    await page.route("**/api/lists/**", (route) => {
      const req = route.request();
      const itemsBulk = req.url().match(/\/lists\/(\d+)\/items\/bulk\/$/);
      if (req.method() === "POST" && itemsBulk) {
        const id = Number(itemsBulk[1]);
        sent.bulk.push(`list-${id}`);
        if (!listItems.has(id)) listItems.set(id, new Set());
        return bulk(listItems.get(id)!, route);
      }
      if (req.method() === "POST") {
        sent.listCreates++;
        const body = req.postDataJSON();
        const list: UserListDTO = {
          id: nextListId++, name: body.name, description: body.description ?? "",
          createdAt: body.createdAt ?? "2024-04-01T00:00:00Z", items: [],
        };
        lists.push(list);
        return route.fulfill({ status: 201, json: list });
      }
      return route.fulfill({ json: paginated(lists) });
    });
  })();
  return { ready, sent, lists };
}

const LOADED_WATCHLIST_ITEM = {
  id: 1, mediaId: 603, mediaType: "movie", title: "The Matrix", posterPath: null, voteAverage: 8.2,
  addedAt: "2023-01-01T10:00:00Z",
} satisfies WatchlistEntryDTO;

async function openProfile(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "More navigation options" }).click();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page.locator(".ant-modal").getByText("Edit Profile")).toBeVisible();
  await page.getByRole("tab", { name: "Data & TMDB" }).click();
}

const dialog = (page: Page, title: string) => page.getByRole("dialog", { name: title });
const BACKUP = "Import All Data from Backup";
const CSV = "Import Watched from CSV";

test.beforeEach(async ({ page }) => {
  await mockAuthedBase(page);
  await page.route("**/api/tmdb-auth/status/**", (r) => r.fulfill({ json: { connected: false } }));
});

async function importBackup(page: Page, isMobile: boolean, file: Awaited<ReturnType<typeof backupFile>>) {
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import All from Backup" }).click();
  const d = dialog(page, BACKUP);
  await d.locator('input[type="file"]').setInputFiles(file);
  await d.getByRole("button", { name: "Import All" }).click();
  // A restore paces its poster lookups, and a failed reload waits out the
  // client's 2 s retry-once-on-500: together they can pass the 5 s default.
  await expect(d.locator(".ant-alert")).toContainText(/Import (complete|finished)/, { timeout: 15_000 });
  return d;
}

test("one section fails: the others are saved and the result says which failed", async ({ page, isMobile }) => {
  const server = mockImportServer(page, { failWatchlistBulk: true });
  await server.ready;
  await page.goto("/watchlist");

  const d = await importBackup(page, isMobile, await backupFile());

  const result = d.locator(".ant-alert");
  await expect(result).toContainText("Import finished with some failures");
  await expect(result).toContainText("Watchlist: 0 added, 0 skipped, 1 failed");
  await expect(result).toContainText("Watched: 1 added, 0 skipped");
  await expect(result).toContainText("Lists: 1 added, 0 skipped (1 new list)");
  expect(server.sent.bulk).toEqual(expect.arrayContaining(["watchlist", "watched", "list-40"]));
});

test("a new list in the backup is created once with its items", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  await page.goto("/watchlist");

  const d = await importBackup(page, isMobile, await backupFile());

  await expect(d.locator(".ant-alert")).toContainText("Import complete");
  await expect(d.locator(".ant-alert")).toContainText("Lists: 1 added, 0 skipped (1 new list)");
  expect(server.sent.listCreates).toBe(1);
  expect(server.lists.map((l) => [l.name, l.description])).toEqual([["Faves", "Best ones"]]);
  expect(server.sent.bulk.filter((b) => b.startsWith("list-"))).toEqual(["list-40"]);
  await expect(page.locator(".ant-message-error")).toHaveCount(0);
});

test("importing the same backup twice skips everything the second time", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  await page.goto("/watchlist");
  const file = await backupFile();

  let d = await importBackup(page, isMobile, file);
  await expect(d.locator(".ant-alert")).toContainText("Import complete");
  await d.getByRole("button", { name: "Done" }).click();
  await expect(d).toBeHidden();
  await page.locator(".ant-modal").filter({ hasText: "Edit Profile" }).getByRole("button", { name: "Close" }).click();

  d = await importBackup(page, isMobile, file);
  const result = d.locator(".ant-alert");
  await expect(result).toContainText("Import complete");
  await expect(result).toContainText("Watchlist: 0 added, 1 skipped");
  await expect(result).toContainText("Watched: 0 added, 1 skipped");
  await expect(result).toContainText("Lists: 0 added, 1 skipped (0 new lists)");
  expect(server.sent.listCreates).toBe(1);
  expect(server.lists).toHaveLength(1);
});

/** Pick `file` twice; the error must be re-rendered by a second read, and the
 *  input cleared each time (what lets a real browser fire `change` again). */
async function pickTwiceExpectingError(page: Page, d: ReturnType<typeof dialog>, file: Parameters<Page["setInputFiles"]>[1], error: RegExp) {
  const input = d.locator('input[type="file"]');
  const alert = d.locator(".ant-alert-error");
  await input.setInputFiles(file);
  await expect(alert).toContainText(error);
  await expect(input).toHaveValue("");
  await alert.evaluate((el) => el.setAttribute("data-first-read", ""));

  await input.setInputFiles(file);
  await expect(d.locator(".ant-alert-error:not([data-first-read])")).toContainText(error);
  await expect(input).toHaveValue("");
}

test("re-selecting the same broken backup reads it again", async ({ page, isMobile }) => {
  await page.goto("/watchlist");
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import All from Backup" }).click();
  await pickTwiceExpectingError(
    page, dialog(page, BACKUP),
    { name: "backup.zip", mimeType: "application/zip", buffer: Buffer.from("not a zip") },
    /Could not read ZIP file/,
  );
});

test("re-selecting the same broken CSV reads it again", async ({ page, isMobile }) => {
  await page.goto("/watchlist");
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import Watched from CSV" }).click();
  await pickTwiceExpectingError(
    page, dialog(page, CSV),
    { name: "watched.csv", mimeType: "text/csv", buffer: Buffer.from("foo,bar\n1,2\n") },
    /Could not find an ID column/,
  );
});

/** Every poster lookup finds one, so the import's result is a plain success. */
async function mockPosters(page: Page) {
  await page.route(/\/api\/tmdb\/(movie|tv)\/\d+/, (r) => r.fulfill({ json: { poster_path: "/p.jpg", vote_average: 7 } }));
}

test("a mixed-type CSV: the preview shows each row's type and tv rows import as TV", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  await mockPosters(page);
  await page.goto("/watchlist");
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import Watched from CSV" }).click();
  const d = dialog(page, CSV);
  await expect(d.getByRole("radio", { name: "Movies" })).toBeChecked();

  await d.locator('input[type="file"]').setInputFiles({
    name: "watched.csv", mimeType: "text/csv",
    buffer: Buffer.from("id,title,type\n550,Fight Club,movie\n1396,Breaking Bad,tv\n603,The Matrix,\n"),
  });
  const rows = d.locator(".ant-table-tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("movie");
  await expect(rows.nth(1)).toContainText("tv");
  await expect(rows.nth(2)).toContainText("movie"); // no type: the dialog's default

  await d.getByRole("button", { name: "Import 3 entries" }).click();
  await expect(page.locator(".ant-message-success")).toContainText("Import complete: 3 added");
  expect(server.sent.watchedBodies.flat().map((e) => [e.mediaId, e.mediaType])).toEqual([
    [550, "movie"], [1396, "tv"], [603, "movie"],
  ]);
});

test("a failed refresh after an import says so, and the loaded items stay", async ({ page, isMobile }) => {
  const server = mockImportServer(page, { failWatchedReloadAfterImport: true });
  await server.ready;
  await page.goto("/watchlist");
  await expect(page.getByText("The Matrix")).toBeVisible();

  await importBackup(page, isMobile, await backupFile());

  await expect(page.locator(".ant-message-error")).toContainText("Imported, but couldn't refresh your library.");
  await expect(page.getByText("The Matrix")).toBeAttached();
});

test("a CSV import whose refresh fails reports success plus the refresh notice, not a failed import", async ({ page, isMobile }) => {
  const server = mockImportServer(page, { failWatchedReloadAfterImport: true });
  await server.ready;
  await mockPosters(page);
  await page.goto("/watchlist");
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import Watched from CSV" }).click();
  const d = dialog(page, CSV);
  await d.locator('input[type="file"]').setInputFiles({
    name: "watched.csv", mimeType: "text/csv", buffer: Buffer.from("id,title\n550,Fight Club\n"),
  });
  await d.getByRole("button", { name: "Import 1 entry" }).click();

  await expect(page.locator(".ant-message-success")).toContainText("Import complete: 1 added");
  await expect(page.locator(".ant-message-error")).toContainText("Imported, but couldn't refresh your library.");
  await expect(page.getByText("Failed to import watched movies")).toHaveCount(0);
});

/** Create-only bulk endpoints for follows and episode progress, recording bodies. */
async function mockSocialServer(page: Page) {
  const bodies = { followed: [] as object[][], progress: [] as object[][] };
  await page.route("**/api/followed-people/**", (route) => {
    if (route.request().method() === "POST" && route.request().url().includes("/followed-people/bulk/")) {
      const entries = route.request().postDataJSON().entries;
      bodies.followed.push(entries);
      return route.fulfill({ json: { added: entries.length, skipped: 0, ignored: 0, overLimit: 0 } });
    }
    return route.fulfill({ json: paginated([]) });
  });
  await page.route("**/api/episode-progress/**", (route) => {
    if (route.request().method() === "POST" && route.request().url().includes("/episode-progress/bulk/")) {
      const entries = route.request().postDataJSON().entries;
      bodies.progress.push(entries);
      return route.fulfill({ json: { added: entries.length, skipped: 0, ignored: 0, overLimit: 0 } });
    }
    return route.fulfill({ json: paginated([]) });
  });
  return bodies;
}

test("a v3 backup restores follows and episode progress", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  const social = await mockSocialServer(page);
  await page.goto("/watchlist");

  const d = await importBackup(page, isMobile, await backupFile([FAVES], {
    followed: [
      { personId: 287, name: "Brad Pitt", profilePath: "/bp.jpg", followedAt: "2024-05-01T10:00:00Z" },
      { personId: 7, name: "Greta Gerwig", profilePath: null, followedAt: "2024-01-02T10:00:00Z" },
    ],
    episodeProgress: [{ showId: 1396, season: 2, episode: 5 }],
  }));

  const result = d.locator(".ant-alert");
  await expect(result).toContainText("Import complete");
  await expect(result).toContainText("Following: 2 added, 0 skipped");
  await expect(result).toContainText("Episode progress: 1 added, 0 skipped");
  expect(social.followed).toEqual([[
    { personId: 287, name: "Brad Pitt", profilePath: "/bp.jpg", followedAt: "2024-05-01T10:00:00Z" },
    { personId: 7, name: "Greta Gerwig", profilePath: null, followedAt: "2024-01-02T10:00:00Z" },
  ]]);
  expect(social.progress).toEqual([[{ showId: 1396, season: 2, episode: 5 }]]);
});

test("two lists with the same name in a backup stay two lists", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  await page.goto("/watchlist");
  const second: UserList = {
    id: 10, name: "Faves", description: "Other ones", createdAt: "2024-03-05T10:00:00Z",
    items: [{ ...FIGHT_CLUB, id: 603, title: "The Matrix", addedAt: "2024-03-06T10:00:00Z" }],
  };

  const d = await importBackup(page, isMobile, await backupFile([FAVES, second]));

  await expect(d.locator(".ant-alert")).toContainText("Lists: 2 added, 0 skipped (2 new lists)");
  expect(server.lists.map((l) => [l.name, l.description])).toEqual([["Faves", "Best ones"], ["Faves", "Other ones"]]);
  expect(server.sent.bulk.filter((b) => b.startsWith("list-"))).toEqual(["list-40", "list-41"]);
});

test("a rate-limited poster lookup is retried, not dropped", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  let lookups = 0;
  await page.route("**/api/tmdb/movie/550**", (route) => {
    lookups++;
    return lookups === 1
      ? route.fulfill({ status: 429, headers: { "Retry-After": "1" }, json: { detail: "Request was throttled." } })
      : route.fulfill({ json: { poster_path: "/fc.jpg", vote_average: 8.4 } });
  });
  await page.goto("/watchlist");
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import Watched from CSV" }).click();
  const d = dialog(page, CSV);
  await d.locator('input[type="file"]').setInputFiles({
    name: "watched.csv", mimeType: "text/csv", buffer: Buffer.from("id,title\n550,Fight Club\n"),
  });
  await d.getByRole("button", { name: "Import 1 entry" }).click();

  await expect(page.locator(".ant-message-success")).toContainText("Import complete: 1 added");
  await expect(page.getByText(/saved without a poster/)).toHaveCount(0);
  expect(lookups).toBe(2);
  expect(server.sent.watchedBodies.flat()).toEqual([expect.objectContaining({ mediaId: 550, posterPath: "/fc.jpg" })]);
});

test("re-importing the Watched page's export keeps each watched time and zone", async ({ page, isMobile }) => {
  const server = mockImportServer(page);
  await server.ready;
  await page.goto("/watchlist");
  await openProfile(page, isMobile);
  await page.getByRole("button", { name: "Import Watched from CSV" }).click();
  const d = dialog(page, CSV);
  // The Watched page's export columns (WatchedPage.handleExport).
  await d.locator('input[type="file"]').setInputFiles({
    name: "watched.csv", mimeType: "text/csv",
    buffer: Buffer.from(
      "title,type,tmdb_id,vote_average,watched_at,watched_tz\n" +
      "Fight Club,movie,550,8.4,2024-03-01T20:00:00Z,Asia/Kolkata\n" +
      "Breaking Bad,tv,1396,8.9,2023-12-24T08:30:00Z,\n",
    ),
  });
  await d.getByRole("button", { name: "Import 2 entries" }).click();
  await expect(page.locator(".ant-message").getByText(/Import complete: 2 added/)).toBeVisible();

  expect(server.sent.watchedBodies.flat().map((e) => {
    const { mediaId, watchedAt, watchedTz } = e as { mediaId: number; watchedAt?: string; watchedTz?: string };
    return [mediaId, watchedAt, watchedTz];
  })).toEqual([[550, "2024-03-01T20:00:00Z", "Asia/Kolkata"], [1396, "2023-12-24T08:30:00Z", undefined]]);
});

test("Export All fails closed when episode progress can't be loaded", async ({ page, isMobile }) => {
  await page.route("**/api/episode-progress/**", (route) => route.fulfill({ status: 500, json: {} }));
  const downloads: string[] = [];
  page.on("download", (dl) => downloads.push(dl.suggestedFilename()));
  await page.goto("/watchlist");
  await openProfile(page, isMobile);

  await page.getByRole("button", { name: "Export All Data (ZIP)" }).click();

  const warning = page.locator(".ant-modal .ant-alert-warning");
  await expect(warning).toContainText("Couldn't load your episode progress");
  await expect(warning.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(downloads).toEqual([]);
});
