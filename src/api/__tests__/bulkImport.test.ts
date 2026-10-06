import userApi, { bulkImport, BULK_CHUNK_SIZE, type BulkImportEntry } from "../userApi";

function entries(n: number): BulkImportEntry[] {
  return Array.from({ length: n }, (_, i) => ({ mediaId: i + 1, title: `T${i + 1}` }));
}

describe("bulkImport", () => {
  afterEach(() => jest.restoreAllMocks());

  it("splits into chunks of BULK_CHUNK_SIZE and sums the results", async () => {
    const post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => {
      const size = (body as { entries: unknown[] }).entries.length;
      return { data: { added: size - 1, skipped: 1 } } as never;
    });
    const result = await bulkImport("watched", entries(1200));
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls.map(([url, body]) => [url, (body as { entries: unknown[] }).entries.length])).toEqual([
      ["/watched/bulk/", BULK_CHUNK_SIZE],
      ["/watched/bulk/", BULK_CHUNK_SIZE],
      ["/watched/bulk/", 200],
    ]);
    expect(result).toEqual({ added: 1197, skipped: 3, failed: 0 });
  });

  it("counts a rejected chunk as failed and keeps going", async () => {
    let call = 0;
    jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => {
      call += 1;
      if (call === 1) throw new Error("400");
      const size = (body as { entries: unknown[] }).entries.length;
      return { data: { added: size, skipped: 0 } } as never;
    });
    const result = await bulkImport("ratings", entries(700));
    expect(result).toEqual({ added: 200, skipped: 0, failed: 500 });
  });

  it("makes no request for an empty import", async () => {
    const post = jest.spyOn(userApi, "post");
    expect(await bulkImport("watchlist", [])).toEqual({ added: 0, skipped: 0, failed: 0 });
    expect(post).not.toHaveBeenCalled();
  });
});
