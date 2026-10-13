import { buildCSVString } from "../export";
import { parseBackupCSV, parseCSV, parseCSVForImport } from "../csvParse";

describe("CSV byte order mark", () => {
  const rows = [{ tmdb_id: 194, title: "Amélie", type: "movie" }];

  it("starts every export with a UTF-8 BOM", () => {
    expect(buildCSVString(rows).charCodeAt(0)).toBe(0xfeff);
  });

  it("round-trips through parseCSV with no stray character in the first column", () => {
    const [header, row] = parseCSV(buildCSVString(rows));
    expect(header).toEqual(["tmdb_id", "title", "type"]);
    expect(row).toEqual(["194", "Amélie", "movie"]);
  });

  it("round-trips through the import parsers", () => {
    const csv = buildCSVString(rows);
    expect(parseCSVForImport(csv).rows).toEqual([{ mediaId: 194, title: "Amélie", type: "movie" }]);
    expect(parseBackupCSV(csv)[0]).toEqual(expect.objectContaining({ mediaId: 194, title: "Amélie" }));
  });
});
