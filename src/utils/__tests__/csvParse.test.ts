import { normalizeWatchedAt, parseCSV, parseCSVForImport, parseBackupCSV } from "../csvParse";
import { buildCSVString } from "../export";

describe("parseCSV", () => {
  it("handles quoted commas, escaped quotes and embedded newlines", () => {
    const text = 'id,title,review\n1,"Fight Club, The","Said ""wow"",\nthen left"\n2,Plain,ok';
    expect(parseCSV(text)).toEqual([
      ["id", "title", "review"],
      ["1", "Fight Club, The", 'Said "wow",\nthen left'],
      ["2", "Plain", "ok"],
    ]);
  });

  it("accepts CRLF and strips a BOM", () => {
    expect(parseCSV("﻿id,title\r\n1,A\r\n")).toEqual([["id", "title"], ["1", "A"]]);
  });

  it("detects semicolon and tab delimiters from the header", () => {
    expect(parseCSV("id;title\n550;Fight Club, The")).toEqual([["id", "title"], ["550", "Fight Club, The"]]);
    expect(parseCSV("id\ttitle\n550\tFight Club")).toEqual([["id", "title"], ["550", "Fight Club"]]);
  });

  it("ignores delimiters inside quoted header fields when detecting", () => {
    expect(parseCSV('"a;b",c\n1,2')).toEqual([["a;b", "c"], ["1", "2"]]);
  });

  it("skips blank lines", () => {
    expect(parseCSV("id,title\n\n1,A\n   \n2,B\n\n")).toEqual([["id", "title"], ["1", "A"], ["2", "B"]]);
  });
});

describe("parseCSVForImport", () => {
  it("reads per-row type when a type column exists", () => {
    const { rows, error } = parseCSVForImport("id;title;media_type\n550;Fight Club;movie\n1396;Breaking Bad;TV\n13;Gump;book");
    expect(error).toBeNull();
    expect(rows).toEqual([
      { mediaId: 550, title: "Fight Club", type: "movie" },
      { mediaId: 1396, title: "Breaking Bad", type: "tv" },
      { mediaId: 13, title: "Gump" },
    ]);
  });

  it("drops rows without a valid positive id", () => {
    const { rows } = parseCSVForImport("id,title\nabc,X\n-4,Y\n0,Z\n7,Ok");
    expect(rows).toEqual([{ mediaId: 7, title: "Ok" }]);
  });

  it("reports missing columns and empty files", () => {
    expect(parseCSVForImport("title\nA").error).toMatch(/ID column/);
    expect(parseCSVForImport("id\n1").error).toMatch(/title column/);
    expect(parseCSVForImport("id,title").error).toMatch(/header row/);
  });
});

describe("parseBackupCSV", () => {
  it("parses the v1 layout", () => {
    const rows = parseBackupCSV("tmdb_id,title,type,vote_average,watched_at,poster_path\n550,Fight Club,movie,8.4,2024-03-01T20:00:00Z,/p.jpg\n1396,BB,tv,,,");
    expect(rows).toEqual([
      { mediaId: 550, title: "Fight Club", type: "movie", voteAverage: 8.4, posterPath: "/p.jpg", watchedAt: "2024-03-01T20:00:00Z" },
      { mediaId: 1396, title: "BB", type: "tv", voteAverage: 0, posterPath: null },
    ]);
  });

  it("keeps review whitespace and reads rating columns", () => {
    const rows = parseBackupCSV('tmdb_id,title,type,user_rating,review,rated_at\n550,FC,movie,8,"  two\nlines ",2024-01-01T00:00:00Z');
    expect(rows[0]).toMatchObject({ userRating: 8, review: "  two\nlines ", ratedAt: "2024-01-01T00:00:00Z" });
  });
});

describe("parseCSVForImport watched times (data-backup)", () => {
  // The Watched page's own export columns (WatchedPage.handleExport).
  const exportRow = (over: Record<string, unknown> = {}) => ({
    title: "Fight Club", type: "movie", tmdb_id: 550, vote_average: 8.4,
    watched_at: "2024-03-01T20:00:00Z", watched_tz: "Asia/Kolkata", ...over,
  });

  it("reads the watched time and zone from the Watched page export", () => {
    const csv = buildCSVString([exportRow(), exportRow({ tmdb_id: 1396, type: "tv", title: "Breaking Bad", watched_tz: "" })]);
    const { rows, error } = parseCSVForImport(csv);
    expect(error).toBeNull();
    expect(rows).toEqual([
      { mediaId: 550, title: "Fight Club", type: "movie", voteAverage: 8.4, watchedAt: "2024-03-01T20:00:00Z", watchedTz: "Asia/Kolkata" },
      { mediaId: 1396, title: "Breaking Bad", type: "tv", voteAverage: 8.4, watchedAt: "2024-03-01T20:00:00Z" },
    ]);
  });

  it("drops a future, garbage or pre-1900 time for that row only", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const csv = buildCSVString([
      exportRow({ tmdb_id: 1, watched_at: future }),
      exportRow({ tmdb_id: 2, watched_at: "not a date" }),
      exportRow({ tmdb_id: 3, watched_at: "1850-01-01T00:00:00Z" }),
      exportRow({ tmdb_id: 4 }),
    ]);
    const rows = parseCSVForImport(csv).rows;
    expect(rows.map((r) => r.mediaId)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.watchedAt)).toEqual([undefined, undefined, undefined, "2024-03-01T20:00:00Z"]);
  });

  it("drops a non-ISO or offset-less time for that row only", () => {
    const csv = buildCSVString([
      exportRow({ tmdb_id: 1, watched_at: "05/01/2024" }),
      exportRow({ tmdb_id: 2, watched_at: "May 1, 2024" }),
      exportRow({ tmdb_id: 3, watched_at: "2024-05-01T10:00" }),
      exportRow({ tmdb_id: 4 }),
    ]);
    const rows = parseCSVForImport(csv).rows;
    expect(rows.map((r) => r.mediaId)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.watchedAt)).toEqual([undefined, undefined, undefined, "2024-03-01T20:00:00Z"]);
  });

  it("keeps a date alone as noon UTC on that day", () => {
    const rows = parseCSVForImport(buildCSVString([exportRow({ watched_at: "2024-05-01", watched_tz: "" })])).rows;
    expect(rows[0]!.watchedAt).toBe("2024-05-01T12:00:00Z");
  });

  it("keeps the API's own format (microseconds, Z) and explicit offsets unchanged", () => {
    for (const value of ["2024-03-01T20:00:00.123456Z", "2024-03-01T20:00:00+05:30", "2024-03-01T20:00-0800"]) {
      expect(normalizeWatchedAt(value)).toBe(value);
    }
  });

  it("leaves a file without the columns as before", () => {
    expect(parseCSVForImport("id,title\n550,Fight Club").rows).toEqual([{ mediaId: 550, title: "Fight Club" }]);
  });
});

describe("parseCSVForImport: the Watched export's extra columns", () => {
  it("reads runtime, platform and poster back, dropping bad values per row", () => {
    const csv = buildCSVString([
      { title: "A", type: "movie", tmdb_id: 1, watched_at: "", runtime_minutes: 120, platform: "Netflix", poster_path: "/a.jpg" },
      { title: "B", type: "movie", tmdb_id: 2, watched_at: "", runtime_minutes: "", platform: "", poster_path: "" },
      { title: "C", type: "movie", tmdb_id: 3, watched_at: "", runtime_minutes: "-5", platform: "x".repeat(101), poster_path: "http://evil/a.jpg" },
    ]);
    const { rows, error } = parseCSVForImport(csv);
    expect(error).toBeNull();
    expect(rows[0]).toMatchObject({ runtimeMinutes: 120, platform: "Netflix", posterPath: "/a.jpg" });
    for (const r of rows.slice(1)) {
      expect(r.runtimeMinutes).toBeUndefined();
      expect(r.platform).toBeUndefined();
      expect(r.posterPath).toBeUndefined();
    }
  });

  it("drops an over-long poster path for that row only", () => {
    const csv = buildCSVString([
      { title: "A", type: "movie", tmdb_id: 1, runtime_minutes: 120, platform: "Netflix", poster_path: `/${"a".repeat(600)}.jpg` },
      { title: "B", type: "movie", tmdb_id: 2, runtime_minutes: "", platform: "", poster_path: `/${"b".repeat(495)}.jpg` },
    ]);
    const { rows } = parseCSVForImport(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.posterPath).toBeUndefined();
    expect(rows[0]!).toMatchObject({ mediaId: 1, runtimeMinutes: 120, platform: "Netflix" });
    expect(rows[1]!.posterPath).toHaveLength(500);
  });

  it("reads the score, dropping a non-numeric or out-of-range one", () => {
    const csv = buildCSVString(
      ["8.4", "0", "10", "", "abc", "11", "-1", "NaN", "Infinity"].map((v, i) => ({ title: "T", tmdb_id: i + 1, vote_average: v })),
    );
    expect(parseCSVForImport(csv).rows.map((r) => r.voteAverage)).toEqual(
      [8.4, 0, 10, undefined, undefined, undefined, undefined, undefined, undefined],
    );
  });
});

// data-backup: a bad value in a backup row is dropped for that row only.
describe("parseBackupCSV: values the server would reject", () => {
  it("drops an oversized or non-path poster_path for that row only", () => {
    const rows = parseBackupCSV(buildCSVString([
      { tmdb_id: 1, title: "A", type: "movie", vote_average: 7, poster_path: `/${"a".repeat(600)}.jpg` },
      { tmdb_id: 2, title: "B", type: "movie", vote_average: 7, poster_path: "http://example.test/p.jpg" },
      { tmdb_id: 3, title: "C", type: "movie", vote_average: 7, poster_path: `/${"c".repeat(495)}.jpg` },
    ]));
    expect(rows.map((r) => r.posterPath?.length ?? null)).toEqual([null, null, 500]);
    expect(rows.map((r) => r.mediaId)).toEqual([1, 2, 3]);
  });

  it("turns an out-of-range or unreadable score into 0", () => {
    const rows = parseBackupCSV("tmdb_id,title,type,vote_average\n1,A,movie,11\n2,B,movie,abc\n3,C,movie,-1\n4,D,movie,7.5\n5,E,movie,\n");
    expect(rows.map((r) => r.voteAverage)).toEqual([0, 0, 0, 7.5, 0]);
  });
});

// data-backup: every value the server would reject is dropped for that row only.
describe("parseBackupCSV: other columns the server bounds", () => {
  const next = `${new Date().getUTCFullYear() + 1}-01-01T00:00:00Z`;

  it("drops a bad runtime, platform, zone or time and keeps the rest of the row", () => {
    const rows = parseBackupCSV(buildCSVString([
      { tmdb_id: 1, title: "A", type: "movie", runtime_minutes: -5, platform: "x".repeat(120), watched_tz: "z".repeat(70), watched_at: next },
      { tmdb_id: 2, title: "B", type: "movie", runtime_minutes: 1.5, platform: "Netflix", watched_tz: "Asia/Kolkata", watched_at: "1850-01-01T00:00:00Z" },
      { tmdb_id: 3, title: "C", type: "movie", runtime_minutes: 120, platform: "Netflix", watched_tz: "Asia/Kolkata", watched_at: "2024-03-01T20:00:00Z" },
    ]));
    expect(rows[0]).toMatchObject({ mediaId: 1, title: "A" });
    for (const k of ["runtimeMinutes", "platform", "watchedTz", "watchedAt"]) expect(rows[0]).not.toHaveProperty(k);
    expect(rows[1]).toMatchObject({ platform: "Netflix", watchedTz: "Asia/Kolkata" });
    expect(rows[1]).not.toHaveProperty("runtimeMinutes");
    expect(rows[1]).not.toHaveProperty("watchedAt");
    expect(rows[2]).toMatchObject({ runtimeMinutes: 120, platform: "Netflix", watchedTz: "Asia/Kolkata", watchedAt: "2024-03-01T20:00:00Z" });
  });

  it("keeps only valid half-step ratings, drops an oversized review and bad added/rated times", () => {
    const rows = parseBackupCSV(buildCSVString([
      { tmdb_id: 1, title: "A", type: "movie", user_rating: 11, review: "ok", rated_at: next, added_at: "nope" },
      { tmdb_id: 2, title: "B", type: "movie", user_rating: 0.3, review: "ok", rated_at: "2024-01-01T00:00:00Z", added_at: "2024-01-01" },
      { tmdb_id: 3, title: "C", type: "movie", user_rating: 7.3, review: "ok", rated_at: "", added_at: "" },
      { tmdb_id: 4, title: "D", type: "movie", user_rating: 7.5, review: "r".repeat(6000), rated_at: "", added_at: "" },
    ]));
    expect(rows.map((r) => r.userRating)).toEqual([undefined, undefined, undefined, 7.5]);
    expect(rows[3]).not.toHaveProperty("review");
    expect(rows[0]).toMatchObject({ review: "ok" });
    expect(rows[0]).not.toHaveProperty("ratedAt");
    expect(rows[0]).not.toHaveProperty("addedAt");
    expect(rows[1]).toMatchObject({ ratedAt: "2024-01-01T00:00:00Z", addedAt: "2024-01-01T12:00:00Z" });
  });

  it("shortens a title over 500 characters in both readers", () => {
    const long = "t".repeat(700);
    expect(parseBackupCSV(buildCSVString([{ tmdb_id: 1, title: long, type: "movie" }]))[0]!.title).toHaveLength(500);
    expect(parseCSVForImport(buildCSVString([{ tmdb_id: 1, title: long }])).rows[0]!.title).toHaveLength(500);
  });
});

// data-backup: limits count characters (code points) as the server does.
describe("import limits count characters, not UTF-16 units", () => {
  const emoji = "\u{1F3AC}"; // two UTF-16 units, one character

  it("cuts a title at 500 characters without splitting an emoji", () => {
    const long = `${"t".repeat(499)}${emoji}${"u".repeat(20)}`;
    for (const title of [
      parseBackupCSV(buildCSVString([{ tmdb_id: 1, title: long, type: "movie" }]))[0]!.title,
      parseCSVForImport(buildCSVString([{ tmdb_id: 1, title: long }])).rows[0]!.title,
    ]) {
      expect(Array.from(title)).toHaveLength(500);
      expect(title.endsWith(emoji)).toBe(true);
    }
  });

  it("keeps a review and platform within the limit even with many emoji", () => {
    const review = `${emoji.repeat(1100)}${"r".repeat(2900)}`; // 4,000 characters, 5,100 units
    const platform = emoji.repeat(60); // 60 characters, 120 units
    const backup = parseBackupCSV(buildCSVString([
      { tmdb_id: 1, title: "A", type: "movie", user_rating: 8, review, platform },
    ]))[0]!;
    expect(backup.review).toBe(review);
    expect(backup.platform).toBe(platform);
    const imported = parseCSVForImport(buildCSVString([{ tmdb_id: 1, title: "A", platform }])).rows[0]!;
    expect(imported.platform).toBe(platform);
  });

  it("still drops a value over the limit in characters", () => {
    const row = parseBackupCSV(buildCSVString([
      { tmdb_id: 1, title: "A", type: "movie", user_rating: 8, review: emoji.repeat(5001), platform: emoji.repeat(101) },
    ]))[0]!;
    expect(row).not.toHaveProperty("review");
    expect(row).not.toHaveProperty("platform");
  });
});

// data-backup: the server allows 5 minutes of clock skew, and so does the import.
describe("normalizeWatchedAt future leeway", () => {
  it("keeps a time up to 5 minutes ahead and drops one a day ahead", () => {
    const soon = new Date(Date.now() + 2 * 60_000).toISOString();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(normalizeWatchedAt(soon)).toBe(soon);
    expect(normalizeWatchedAt(tomorrow)).toBeUndefined();
    const row = parseBackupCSV(buildCSVString([{ tmdb_id: 1, title: "A", type: "movie", added_at: soon }]))[0]!;
    expect(row.addedAt).toBe(soon);
  });
});
