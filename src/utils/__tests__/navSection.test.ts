import { navSection } from "../navSection";

const PATHS = ["/movies", "/tv", "/watched", "/lists", "/people"];

describe("navSection", () => {
  it("matches a top-level page exactly", () => {
    expect(navSection("/watched", PATHS)).toBe("/watched");
  });

  it("maps a sub-page to its section", () => {
    expect(navSection("/lists/3", PATHS)).toBe("/lists");
  });

  it("leaves detail pages under no entry", () => {
    expect(navSection("/movie/550", PATHS)).toBeNull();
    expect(navSection("/tv/1396", PATHS)).toBeNull();
    expect(navSection("/person/287", PATHS)).toBeNull();
  });

  it("never matches a longer sibling path", () => {
    expect(navSection("/listsx", PATHS)).toBeNull();
  });
});
