import userApi, {
  bindSessionUser, bulkAddListItems, bulkImport, BULK_CHUNK_SIZE, BULK_MAX_BYTES, sessionGuard, SessionEndedError, type BulkImportEntry,
} from "../userApi";

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

  it("keeps each request under BULK_MAX_BYTES when rows are large", async () => {
    // 500 ratings with 5,000-emoji reviews (4 UTF-8 bytes each): ~10 MB in one
    // 500-row request, past Django's 2.5 MB body limit and nginx's 8 MB.
    const review = "\u{1F3AC}".repeat(5000);
    const rows: BulkImportEntry[] = entries(500).map((e) => ({ ...e, userRating: 8, review }));
    const sizes: number[] = [];
    const sent: number[] = [];
    const post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => {
      const chunk = (body as { entries: BulkImportEntry[] }).entries;
      sizes.push(Buffer.byteLength(JSON.stringify(body), "utf8"));
      sent.push(...chunk.map((e) => e.mediaId));
      return { data: { added: chunk.length, skipped: 0 } } as never;
    });
    const result = await bulkImport("ratings", rows);
    expect(post.mock.calls.length).toBeGreaterThan(4);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(BULK_MAX_BYTES);
    expect(sent).toEqual(rows.map((e) => e.mediaId));
    expect(result).toEqual({ added: 500, skipped: 0, failed: 0 });
  });

  it("sends a single oversize row on its own rather than dropping it", async () => {
    const huge = { mediaId: 1, title: "x".repeat(BULK_MAX_BYTES + 10) };
    const post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => (
      { data: { added: (body as { entries: unknown[] }).entries.length, skipped: 0 } } as never
    ));
    expect(await bulkImport("watched", [...entries(2), huge, ...entries(1)])).toEqual({ added: 4, skipped: 0, failed: 0 });
    expect(post.mock.calls.map(([, body]) => (body as { entries: unknown[] }).entries.length)).toEqual([2, 1, 1]);
  });

  it("makes no request for an empty import", async () => {
    const post = jest.spyOn(userApi, "post");
    expect(await bulkImport("watchlist", [])).toEqual({ added: 0, skipped: 0, failed: 0 });
    expect(post).not.toHaveBeenCalled();
  });
});

describe("bulkAddListItems", () => {
  afterEach(() => jest.restoreAllMocks());

  it("adds 1,200 list items in 3 requests to the list's bulk route", async () => {
    const post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => {
      const size = (body as { entries: unknown[] }).entries.length;
      return { data: { added: size, skipped: 0 } } as never;
    });
    const result = await bulkAddListItems(7, entries(1200));
    expect(post.mock.calls.map(([url]) => url)).toEqual(Array(3).fill("/lists/7/items/bulk/"));
    expect(result).toEqual({ added: 1200, skipped: 0, failed: 0 });
  });
});

describe("bulk imports with a session guard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    bindSessionUser(null);
  });

  it("sends no further chunk once the session that started the import has ended", async () => {
    bindSessionUser(1);
    const guard = sessionGuard();
    const post = jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => {
      // Sign out, and in as someone else, while the first chunk is in flight.
      bindSessionUser(2);
      return { data: { added: (body as { entries: unknown[] }).entries.length, skipped: 0 } } as never;
    });
    await expect(bulkImport("watched", entries(1200), { guard })).rejects.toBeInstanceOf(SessionEndedError);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("sends nothing if the session ended before the import started writing", async () => {
    bindSessionUser(1);
    const guard = sessionGuard();
    bindSessionUser(null);
    const post = jest.spyOn(userApi, "post");
    await expect(bulkAddListItems(7, entries(3), { guard })).rejects.toBeInstanceOf(SessionEndedError);
    expect(post).not.toHaveBeenCalled();
  });

  it("imports normally while the session is unchanged", async () => {
    bindSessionUser(1);
    const guard = sessionGuard();
    jest.spyOn(userApi, "post").mockImplementation(async (_url, body) => (
      { data: { added: (body as { entries: unknown[] }).entries.length, skipped: 0 } } as never
    ));
    expect(await bulkImport("watchlist", entries(600), { guard })).toEqual({ added: 600, skipped: 0, failed: 0 });
    expect(guard.isCurrent()).toBe(true);
  });
});
