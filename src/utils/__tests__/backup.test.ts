import JSZip from "jszip";
import { buildBackupZip, readBackupZip } from "../backup";
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

describe("backup v2 round trip", () => {
  it("preserves every field, empty lists and colliding list names", async () => {
    const zip = buildBackupZip(watchlist, watched, ratings, lists, "2024-04-01T00:00:00Z");
    const files = Object.keys(zip.files).filter((f) => f.startsWith("lists/") && f.endsWith(".csv"));
    expect(new Set(files.map((f) => f.toLowerCase())).size).toBe(2);

    const data = await roundTrip(zip);
    expect(data.version).toBe(2);
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
  });

  it("rejects a ZIP with nothing recognizable", async () => {
    const zip = new JSZip();
    zip.file("notes.txt", "hi");
    await expect(roundTrip(zip)).rejects.toThrow(/No recognizable CSV files/);
  });
});
