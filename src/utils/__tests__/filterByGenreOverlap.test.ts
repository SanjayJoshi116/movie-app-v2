import { filterByGenreOverlap, genreIdsOf } from "../filterByGenreOverlap";

type Item = { id: number; genre_ids?: unknown };

describe("filterByGenreOverlap", () => {
  const items: Item[] = [
    { id: 1, genre_ids: [28, 12] },
    { id: 2, genre_ids: [35] },
    { id: 3 },
    { id: 4, genre_ids: "28" },
  ];

  it("keeps items sharing at least half the source genres", () => {
    expect(filterByGenreOverlap(items, [28, 12]).map((i) => i.id)).toEqual([1]);
  });

  it("treats an item without a genre_ids list as sharing none (fix-hooks-sweep-f2)", () => {
    expect(() => filterByGenreOverlap(items, [28])).not.toThrow();
    expect(filterByGenreOverlap(items, [28]).map((i) => i.id)).toEqual([1]);
  });

  it("drops null and non-object items", () => {
    const mixed = [null, 5, "x", { id: 1, genre_ids: [28] }] as unknown as Item[];
    expect(filterByGenreOverlap(mixed, [28])).toEqual([{ id: 1, genre_ids: [28] }]);
    expect(filterByGenreOverlap(mixed, [])).toEqual([{ id: 1, genre_ids: [28] }]);
  });

  it("returns the items unfiltered when the source has no genres", () => {
    expect(filterByGenreOverlap(items, undefined)).toHaveLength(4);
    expect(filterByGenreOverlap(items, genreIdsOf(undefined))).toHaveLength(4);
    expect(filterByGenreOverlap(items, genreIdsOf("bad"))).toHaveLength(4);
  });

  it("falls back to all items when none overlap, and accepts a missing list", () => {
    expect(filterByGenreOverlap(items, [99]).map((i) => i.id)).toEqual([1, 2, 3, 4]);
    expect(filterByGenreOverlap<Item>(undefined, [28])).toEqual([]);
    expect(filterByGenreOverlap<Item>({ results: [] } as unknown as Item[], [28])).toEqual([]);
  });

  it("genreIdsOf keeps numeric ids of genre objects", () => {
    expect(genreIdsOf([{ id: 28, name: "Action" }, null, { id: "12" }, { name: "x" }, { id: 35 }])).toEqual([28, 35]);
  });
});
