import { prefillRuntime } from "../watchRuntime";

describe("prefillRuntime", () => {
  it("uses a movie's runtime", () => {
    expect(prefillRuntime("movie", { runtime: 139 })).toBe(139);
  });

  it("leaves a movie with runtime 0 or missing blank", () => {
    expect(prefillRuntime("movie", { runtime: 0 })).toBeUndefined();
    expect(prefillRuntime("movie", {})).toBeUndefined();
    expect(prefillRuntime("movie", null)).toBeUndefined();
  });

  it("counts a whole series as episodes × episode runtime", () => {
    expect(prefillRuntime("tv", { number_of_episodes: 62, episode_run_time: [47, 58] })).toBe(2914);
  });

  it("falls back to the latest episode's runtime", () => {
    expect(prefillRuntime("tv", { number_of_episodes: 10, episode_run_time: [], last_episode_to_air: { runtime: 55 } })).toBe(550);
  });

  it("leaves a show blank when either number is unknown", () => {
    expect(prefillRuntime("tv", { number_of_episodes: 10, episode_run_time: [], last_episode_to_air: null })).toBeUndefined();
    expect(prefillRuntime("tv", { number_of_episodes: 0, episode_run_time: [45] })).toBeUndefined();
  });

  it("ignores malformed values", () => {
    expect(prefillRuntime("tv", { number_of_episodes: 10, episode_run_time: "45" as unknown as number[] })).toBeUndefined();
    expect(prefillRuntime("movie", { runtime: Number.NaN })).toBeUndefined();
  });
});
