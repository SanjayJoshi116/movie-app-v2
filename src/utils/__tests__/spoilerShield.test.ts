import { isEpisodeHidden } from "../spoilerShield";

const at = { season: 2, episode: 4 };

describe("isEpisodeHidden", () => {
  it("hides a later episode in the tracked season", () => {
    expect(isEpisodeHidden(2, 5, at)).toBe(true);
  });

  it("shows the tracked episode and earlier ones in its season", () => {
    expect(isEpisodeHidden(2, 4, at)).toBe(false);
    expect(isEpisodeHidden(2, 1, at)).toBe(false);
  });

  it("hides every episode of a later season", () => {
    expect(isEpisodeHidden(3, 1, at)).toBe(true);
  });

  it("shows every episode of an earlier season", () => {
    expect(isEpisodeHidden(1, 20, at)).toBe(false);
  });

  it("never hides specials", () => {
    expect(isEpisodeHidden(0, 9, { season: 1, episode: 2 })).toBe(false);
  });

  it("hides nothing without progress", () => {
    expect(isEpisodeHidden(5, 5, null)).toBe(false);
  });
});
