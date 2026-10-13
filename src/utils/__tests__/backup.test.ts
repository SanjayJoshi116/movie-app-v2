import JSZip from "jszip";
import {
  buildBackupZip,
  readBackupZip,
  checkBackupFileSize,
  checkBackupZipSize,
  declaredUncompressedSize,
  BackupTooLargeError,
  MAX_BACKUP_ENTRY_BYTES,
  MAX_BACKUP_FILE_BYTES,
} from "../backup";
import type { RatingEntry, UserList, WatchedEntry, WatchlistEntry } from "../../types";

async function roundTrip(zip: JSZip) {
  return readBackupZip(await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" })));
}

const watchlist: WatchlistEntry[] = [
  { id: 13, type: "movie", title: "Forrest Gump", posterPath: "/fg.jpg", voteAverage: 8.5, addedAt: "2024-02-01T10:00:00Z" },
];
const watched: WatchedEntry[] = [
  { id: 550, type: "movie", title: "Fight Club", posterPath: "/fc.jpg", voteAverage: 8.4, watchedAt: "2024-03-01T20:00:00Z", watchedTz: "Asia/Kolkata", runtimeMinutes: 139, platform: "Netflix" },
  { id: 1396, type: "tv", title: "Breaking Bad", posterPath: null, voteAverage: 9, watchedAt: "2023-12-24T08:30:00Z" },
];
const ratings: RatingEntry[] = [
  { id: 550, type: "movie", title: "Fight Club", userRating: 8, review: 'Great, "must" see,\nreally', ratedAt: "2024-03-02T09:00:00Z" },
];
const lists: UserList[] = [
  { id: 1, name: "Sci-Fi / Horror", description: "spooky", items: [], createdAt: "2024-01-01T00:00:00Z" },
  { id: 2, name: "Sci-Fi : Horror", description: "", createdAt: "2024-01-01T00:00:00Z", items: [watchlist[0]!] },
];

describe("backup round trip", () => {
  it("preserves every field, empty lists and colliding list names", async () => {
    const zip = buildBackupZip(watchlist, watched, ratings, lists, "2024-04-01T00:00:00Z");
    const files = Object.keys(zip.files).filter((f) => f.startsWith("lists/") && f.endsWith(".csv"));
    expect(new Set(files.map((f) => f.toLowerCase())).size).toBe(2);

    const data = await roundTrip(zip);
    expect(data.version).toBe(3);
    expect(data.watchlist).toEqual([
      { mediaId: 13, title: "Forrest Gump", type: "movie", voteAverage: 8.5, posterPath: "/fg.jpg", addedAt: "2024-02-01T10:00:00Z" },
    ]);
    expect(data.watched[0]).toEqual({
      mediaId: 550, title: "Fight Club", type: "movie", voteAverage: 8.4, posterPath: "/fc.jpg",
      watchedAt: "2024-03-01T20:00:00Z", watchedTz: "Asia/Kolkata", runtimeMinutes: 139, platform: "Netflix",
    });
    expect(data.watched[1]).toMatchObject({ mediaId: 1396, type: "tv", posterPath: null });
    expect(data.watched[1]).not.toHaveProperty("runtimeMinutes");
    expect(data.watched[1]).not.toHaveProperty("platform");
    expect(data.watched[1]).not.toHaveProperty("watchedTz"); // logged before zones were recorded
    expect(data.ratings).toEqual([
      { mediaId: 550, title: "Fight Club", type: "movie", voteAverage: 0, posterPath: null, userRating: 8, review: 'Great, "must" see,\nreally', ratedAt: "2024-03-02T09:00:00Z" },
    ]);
    expect(data.lists.map((l) => [l.name, l.description, l.entries.length])).toEqual([
      ["Sci-Fi / Horror", "spooky", 0],
      ["Sci-Fi : Horror", "", 1],
    ]);
  });

  it("carries each list's createdAt and item addedAt through the manifest", async () => {
    const data = await roundTrip(buildBackupZip(watchlist, watched, ratings, lists));
    expect(data.lists.map((l) => l.createdAt)).toEqual(["2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"]);
    expect(data.lists[1]!.entries[0]).toMatchObject({ addedAt: "2024-02-01T10:00:00Z" });
  });

  it("reads a manifest without createdAt (older v2 backup)", async () => {
    const zip = buildBackupZip(watchlist, watched, ratings, lists);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    for (const l of manifest.lists) delete l.createdAt;
    zip.file("manifest.json", JSON.stringify(manifest));
    const data = await roundTrip(zip);
    expect(data.lists).toHaveLength(2);
    expect(data.lists[0]).not.toHaveProperty("createdAt");
  });

  it("still reads a v1 backup (no manifest), naming lists from files", async () => {
    const zip = new JSZip();
    zip.file("watchlist.csv", "tmdb_id,title,type,vote_average,added_at,poster_path\n13,Forrest Gump,movie,8.5,2024-02-01T10:00:00Z,");
    zip.file("watched.csv", "tmdb_id,title,type,vote_average,watched_at,poster_path\n550,Fight Club,movie,8.4,2024-03-01T20:00:00Z,/fc.jpg");
    zip.file("lists/Faves.csv", "tmdb_id,title,type,vote_average,added_at,poster_path\n1396,Breaking Bad,tv,9,,");
    const data = await roundTrip(zip);
    expect(data.version).toBe(1);
    expect(data.watchlist).toHaveLength(1);
    expect(data.watched[0]).toMatchObject({ mediaId: 550, watchedAt: "2024-03-01T20:00:00Z" });
    expect(data.watched[0]).not.toHaveProperty("watchedTz");
    expect(data.ratings).toEqual([]);
    expect(data.lists).toEqual([{ name: "Faves", description: "", entries: [expect.objectContaining({ mediaId: 1396, type: "tv" })] }]);
    expect(data.followed).toEqual([]);
    expect(data.episodeProgress).toEqual([]);
  });

  it("v3 keeps follows (order, profile, followed time) and episode progress", async () => {
    const social = {
      followed: [
        { personId: 287, name: "Brad Pitt", profilePath: "/bp.jpg", followedAt: "2024-05-01T10:00:00Z" },
        { personId: 7, name: "Greta, \"the\" Gerwig", profilePath: null, followedAt: "2024-01-02T10:00:00Z" },
      ],
      episodeProgress: [{ showId: 1396, season: 2, episode: 5 }],
    };
    const data = await roundTrip(buildBackupZip(watchlist, watched, ratings, lists, undefined, social));
    expect(data.followed).toEqual(social.followed);
    expect(data.episodeProgress).toEqual(social.episodeProgress);
  });

  it("writes header-only follow and progress files when there are none", async () => {
    const zip = buildBackupZip(watchlist, watched, ratings, lists);
    // CSV_BOM first, so spreadsheets read the file as UTF-8.
    expect(await zip.file("followed.csv")!.async("string")).toMatch(/^﻿?person_id,name,profile_path,followed_at$/);
    expect(await zip.file("episode_progress.csv")!.async("string")).toMatch(/^﻿?show_id,season,episode$/);
  });

  it("reads a v2 backup (no follow or progress files) with both empty", async () => {
    const zip = buildBackupZip(watchlist, watched, ratings, lists);
    zip.remove("followed.csv");
    zip.remove("episode_progress.csv");
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    zip.file("manifest.json", JSON.stringify({ ...manifest, version: 2 }));
    const data = await roundTrip(zip);
    expect(data.version).toBe(2);
    expect(data.followed).toEqual([]);
    expect(data.episodeProgress).toEqual([]);
    expect(data.watched).toHaveLength(2);
  });

  it("accepts a backup that holds only follows", async () => {
    const zip = new JSZip();
    zip.file("followed.csv", "person_id,name,profile_path,followed_at\n7,Greta Gerwig,,");
    const data = await roundTrip(zip);
    expect(data.followed).toEqual([{ personId: 7, name: "Greta Gerwig", profilePath: null }]);
  });

  it("rejects a ZIP with nothing recognizable", async () => {
    const zip = new JSZip();
    zip.file("notes.txt", "hi");
    await expect(roundTrip(zip)).rejects.toThrow(/No recognizable CSV files/);
  });
});

describe("backup size guard", () => {
  async function reload(zip: JSZip) {
    return JSZip.loadAsync(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  }

  it("reads declared sizes from the installed JSZip without decompressing", async () => {
    const zip = new JSZip();
    zip.file("watched.csv", "x".repeat(12345));
    const loaded = await reload(zip);
    const entry = loaded.file("watched.csv")!;
    const read = jest.spyOn(entry, "async");
    expect(declaredUncompressedSize(entry)).toBe(12345);
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects a zip bomb before any entry is read", async () => {
    const zip = new JSZip();
    zip.file("watched.csv", "a".repeat(MAX_BACKUP_ENTRY_BYTES + 1));
    const loaded = await reload(zip);
    const read = jest.spyOn(loaded.file("watched.csv")!, "async");
    expect(() => checkBackupZipSize(loaded)).toThrow(BackupTooLargeError);
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before it is opened", () => {
    expect(() => checkBackupFileSize(MAX_BACKUP_FILE_BYTES + 1)).toThrow(BackupTooLargeError);
    expect(() => checkBackupFileSize(MAX_BACKUP_FILE_BYTES)).not.toThrow();
  });

  it("lets a normal backup through", async () => {
    const loaded = await reload(buildBackupZip(watchlist, watched, ratings, lists));
    expect(() => checkBackupZipSize(loaded)).not.toThrow();
    expect((await readBackupZip(loaded)).watched).toHaveLength(2);
  });
});
