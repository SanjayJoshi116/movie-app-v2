import { parseIntParam, pickKey } from "../queryParams";

describe("parseIntParam", () => {
  const page = (v: string | null) => parseIntParam(v, { fallback: 1, min: 1 });
  const size = (v: string | null) => parseIntParam(v, { fallback: 48, allowed: [12, 24, 48, 96] });

  it("reads a whole number", () => {
    expect(page("3")).toBe(3);
    expect(size("24")).toBe(24);
  });

  it.each([null, "", "abc", "1.5", "-2", "0", "1e3", "99999999999999999999"])("falls back for page %p", (v) => {
    expect(page(v)).toBe(1);
  });

  it.each(["-5", "50", "12.0", "abc"])("falls back for pageSize %p", (v) => {
    expect(size(v)).toBe(48);
  });
});

describe("pickKey", () => {
  it("keeps a known key and falls back otherwise", () => {
    expect(pickKey("tv", ["movies", "tv"], "movies")).toBe("tv");
    expect(pickKey("nope", ["movies", "tv"], "movies")).toBe("movies");
    expect(pickKey(null, ["movies", "tv"], "movies")).toBe("movies");
  });
});
