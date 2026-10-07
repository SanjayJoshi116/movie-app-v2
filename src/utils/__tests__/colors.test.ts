import { AVATAR_COLORS, avatarColor, ratingColor } from "../colors";
import { RATING_BAD, RATING_WARN, WATCHED_GREEN } from "../../constants/ui";

describe("ratingColor", () => {
  it.each([
    [8, WATCHED_GREEN],
    [7.9, RATING_WARN],
    [5, RATING_WARN],
    [4.9, RATING_BAD],
  ])("maps %p to %p", (vote, expected) => {
    expect(ratingColor(vote)).toBe(expected);
  });
});

describe("avatarColor", () => {
  it("returns the same color for the same username", () => {
    expect(avatarColor("alice")).toBe(avatarColor("alice"));
  });

  it("always returns a palette color, including for an empty name", () => {
    for (const name of ["", "a", "bob", "a-very-long-username-with-digits-123"]) {
      expect(AVATAR_COLORS).toContain(avatarColor(name));
    }
  });
});
