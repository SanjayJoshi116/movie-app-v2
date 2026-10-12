import { useCallback } from "react";
import { App } from "antd";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useInfiniteScroll } from "../useInfiniteScroll";
import { usePaginatedFetch, PageResult } from "../usePaginatedFetch";

type Item = { id: number };

// Like the real IntersectionObserver with the sentinel in view: every
// observe() reports an intersection.
class AlwaysVisibleObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    queueMicrotask(() => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never));
  }
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

function Grid({ fetchPage }: { fetchPage: (p: number) => Promise<PageResult<Item>> }) {
  const stableFetch = useCallback(fetchPage, [fetchPage]);
  const { items, hasMore, loading, loadingMore, loadMore, loadMoreError, retryLoadMore } =
    usePaginatedFetch<Item>({ fetchPage: stableFetch, restore: { isReturning: false, savedLoadedPages: 1, savedScrollY: 0 } });
  // No !loadMoreError here on purpose: the hook itself must stop the loop.
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);
  return (
    <div>
      <span data-testid="count">{items.length}</span>
      <div ref={sentinelRef} />
      {loadMoreError != null && <button onClick={retryLoadMore}>Retry</button>}
    </div>
  );
}

describe("infinite scroll after a failed page", () => {
  const original = window.IntersectionObserver;
  beforeEach(() => { window.IntersectionObserver = AlwaysVisibleObserver as never; });
  afterEach(() => { window.IntersectionObserver = original; });

  it("requests the failing page once, not in a loop, until Retry", async () => {
    let page2Calls = 0;
    let failPage2 = true;
    const fetchPage = jest.fn(async (p: number): Promise<PageResult<Item>> => {
      if (p === 1) return { results: [{ id: 1 }], totalPages: 3 };
      if (p === 2) {
        page2Calls += 1;
        if (failPage2) throw new Error("down");
        return { results: [{ id: 2 }], totalPages: 2 };
      }
      throw new Error(`unexpected page ${p}`);
    });
    render(<App><Grid fetchPage={fetchPage} /></App>);

    await screen.findByRole("button", { name: "Retry" });
    // Give a looping observer plenty of chances to fire again.
    for (let i = 0; i < 20; i += 1) await act(async () => { await Promise.resolve(); });
    expect(page2Calls).toBe(1);
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    failPage2 = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(page2Calls).toBe(2);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
