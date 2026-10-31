import { importResultToast, notAddedParts } from "../importSummary";

describe("notAddedParts", () => {
  it("is empty when every entry was added or already there", () => {
    expect(notAddedParts({ ignored: 0, overLimit: 0 }, "watched")).toEqual([]);
  });

  it("names rows without an id and rows past the limit", () => {
    expect(notAddedParts({ ignored: 2, overLimit: 400 }, "watched")).toEqual([
      "2 without a TMDB id",
      "400 not added: watched history is full",
    ]);
  });
});

describe("importResultToast", () => {
  const result = { added: 2, skipped: 1, ignored: 0, overLimit: 0, failed: 0 };
  const names = { already: "already watched", collection: "watched" as const };

  it("is a success when everything was added or already there", () => {
    expect(importResultToast(result, { ...names, missing: 0 })).toEqual({
      kind: "success", text: "Import complete: 2 added, 1 already watched.",
    });
  });

  it("is info when some titles ended up without a poster", () => {
    expect(importResultToast(result, { ...names, missing: 1 })).toEqual({
      kind: "info", text: "Import complete: 2 added, 1 already watched. 1 saved without a poster.",
    });
  });

  it("is an error when rows failed or hit the limit", () => {
    expect(importResultToast({ ...result, overLimit: 3, failed: 4 }, { ...names, missing: 0 })).toEqual({
      kind: "error", text: "Import finished: 2 added, 1 already watched, 3 not added: watched history is full, 4 failed.",
    });
  });
});
