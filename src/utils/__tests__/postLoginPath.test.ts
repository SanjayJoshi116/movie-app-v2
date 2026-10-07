import { postLoginPath } from "../postLoginPath";

describe("postLoginPath", () => {
  it("keeps the query string and hash of the original location", () => {
    expect(postLoginPath({ from: { pathname: "/search", search: "?tab=people", hash: "#top" } })).toBe(
      "/search?tab=people#top"
    );
  });

  it("returns the bare path when there is no query or hash", () => {
    expect(postLoginPath({ from: { pathname: "/stats" } })).toBe("/stats");
  });

  it.each([null, undefined, {}, { from: null }])("falls back to /movies for state %p", (state) => {
    expect(postLoginPath(state)).toBe("/movies");
  });

  it.each(["/login", "/register", "/forgot-password"])("ignores an auth page (%s) as from, to avoid a loop", (pathname) => {
    expect(postLoginPath({ from: { pathname, search: "?x=1" } })).toBe("/movies");
  });
});
