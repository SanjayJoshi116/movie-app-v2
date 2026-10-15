import { deviceRegion, pickRegion, regionName } from "../region";

describe("deviceRegion", () => {
  it.each([
    ["en-IN", "IN"],
    ["de-DE", "DE"],
    ["hi", "IN"],
    ["en", "US"],
    [undefined, "US"],
    ["not a locale!", "US"],
  ])("%s → %s", (locale, region) => {
    expect(deviceRegion(locale)).toBe(region);
  });
});

it("names regions in English, or keeps the code", () => {
  expect(regionName("IN")).toBe("India");
  expect(regionName("not-a-code")).toBe("not-a-code");
});

describe("pickRegion", () => {
  const data = { US: "us-data", IN: "in-data" };

  it("uses the user's region when TMDB has it", () => {
    expect(pickRegion(data, "IN")).toEqual({ code: "IN", data: "in-data", fallback: false });
  });

  it("falls back to the US, marked as a fallback", () => {
    expect(pickRegion(data, "DE")).toEqual({ code: "US", data: "us-data", fallback: true });
  });

  it("has nothing when neither exists", () => {
    expect(pickRegion({ FR: "x" }, "DE")).toEqual({ code: "DE", data: undefined, fallback: false });
    expect(pickRegion(undefined, "US")).toEqual({ code: "US", data: undefined, fallback: false });
  });
});
