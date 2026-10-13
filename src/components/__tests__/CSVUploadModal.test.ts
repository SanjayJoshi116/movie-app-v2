import { templateRows } from "../CSVUploadModal";
import { buildCSVString } from "../../utils/export";
import { parseCSV, parseCSVForImport } from "../../utils/csvParse";

describe("CSV import templates", () => {
  it.each(["movie", "tv"] as const)("%s template has only columns the import reads", (type) => {
    const csv = buildCSVString(templateRows(type));
    expect(parseCSV(csv)[0]).toEqual(["id", "title", "type"]);

    const { rows, error } = parseCSVForImport(csv);
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === type && r.mediaId > 0 && r.title)).toBe(true);
  });
});
