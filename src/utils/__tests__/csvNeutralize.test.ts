import JSZip from "jszip";
import { buildCSVString } from "../export";
import { parseCSV } from "../csvParse";
import { buildBackupZip, readBackupZip } from "../backup";
import type { WatchlistEntry } from "../../types";

// Values a spreadsheet would run as a formula, plus the apostrophe cases that
// make the export prefix / import strip pair reversible.
const TRICKY = [
  "=SUM(1)",
  '=HYPERLINK("https://example.com","x")',
  "+1",
  "-x",
  "@a",
  "\tTabbed",
  "\rCarriage",
  "'Salem's Lot",
  "''x",
  "'=already",
  "plain",
  "Don't = trouble",
];

describe("CSV formula neutralization", () => {
  it("prefixes every formula-like cell with an apostrophe, and nothing else", () => {
    for (const title of TRICKY) {
      // Single-column export: everything after the header line is the cell.
      const cell = buildCSVString([{ title }]).slice("title\n".length);
      const text = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
      const expected = /^[=+\-@\t\r']/.test(title) ? `'${title}` : title;
      expect({ title, text }).toEqual({ title, text: expected });
    }
  });

  it("round-trips every value exactly through parseCSV", () => {
    const rows = TRICKY.map((title, i) => ({ id: i + 1, title, rating: -1 }));
    const [header, ...parsed] = parseCSV(buildCSVString(rows));
    expect(header).toEqual(["id", "title", "rating"]);
    expect(parsed).toEqual(rows.map((r) => [String(r.id), r.title, "-1"]));
  });

  it("imports a pre-neutralization file's leading apostrophe unchanged", () => {
    expect(parseCSV("tmdb_id,title\n1,'Salem's Lot\n2,'Til Death")).toEqual([
      ["tmdb_id", "title"],
      ["1", "'Salem's Lot"],
      ["2", "'Til Death"],
    ]);
  });

  it("keeps a backup lossless for titles starting with = - @ and '", async () => {
    const titles = ["=Formula", "-Minus", "@At", "'Salem's Lot", "''Double"];
    const watchlist: WatchlistEntry[] = titles.map((title, i) => ({
      id: i + 1, type: "movie", title, posterPath: null, voteAverage: 7, addedAt: "2024-02-01T10:00:00Z",
    }));
    const zip = buildBackupZip(watchlist, [], [], [], "2024-04-01T00:00:00Z");
    const data = await readBackupZip(await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" })));
    expect(data.watchlist.map((e) => e.title)).toEqual(titles);
  });
});
