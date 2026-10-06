import { parseCSV, parseCSVForImport, parseBackupCSV } from "../csvParse";

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
