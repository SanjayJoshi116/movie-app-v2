import { orderForImport } from "../listImport";

type Row = { title: string; addedAt?: string };

describe("orderForImport", () => {
  it("sends undated rows in reverse, so a newest-first list shows file order", () => {
    const rows: Row[] = [{ title: "A" }, { title: "B" }, { title: "C" }];
    expect(orderForImport(rows, (r) => r.addedAt).map((r) => r.title)).toEqual(["C", "B", "A"]);
  });

  it("leaves dated rows in place (their dates decide the order) and puts them first", () => {
    const rows: Row[] = [
      { title: "Old", addedAt: "2023-01-01T00:00:00Z" },
      { title: "X" },
      { title: "New", addedAt: "2024-01-01T00:00:00Z" },
      { title: "Y" },
    ];
    expect(orderForImport(rows, (r) => r.addedAt).map((r) => r.title)).toEqual(["Old", "New", "Y", "X"]);
  });

  it("doesn't mutate its input", () => {
    const rows: Row[] = [{ title: "A" }, { title: "B" }];
    orderForImport(rows, (r) => r.addedAt);
    expect(rows.map((r) => r.title)).toEqual(["A", "B"]);
  });
});
