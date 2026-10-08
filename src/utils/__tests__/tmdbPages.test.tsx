import React from "react";
import { App } from "antd";
import { renderHook, act, waitFor } from "@testing-library/react";
import { pageableTotal, TMDB_MAX_PAGES } from "../tmdbPages";
import { usePaginatedFetch, type PageResult } from "../../hooks/usePaginatedFetch";

const wrapper = ({ children }: { children: React.ReactNode }) => <App>{children}</App>;

describe("pageableTotal", () => {
  it("caps TMDB's reported page count at the 500 it will serve", () => {
    expect(pageableTotal(9999)).toBe(TMDB_MAX_PAGES);
    expect(TMDB_MAX_PAGES).toBe(500);
  });

  it("leaves smaller counts alone", () => {
    expect(pageableTotal(3)).toBe(3);
  });
});

describe("infinite scroll at the page cap", () => {
  it("stops after the last pageable page instead of requesting page 501", async () => {
    // A list TMDB claims has 9999 pages, already scrolled to page 499.
    const fetchPage = jest.fn(
      async (p: number): Promise<PageResult<{ id: number }>> => ({ results: [{ id: p }], totalPages: pageableTotal(9999) })
    );
    const restore = { isReturning: true, savedLoadedPages: 499, savedScrollY: 0 };
    const { result } = renderHook(() => usePaginatedFetch({ fetchPage, restore }), { wrapper });
    await waitFor(() => expect(result.current.currentPage).toBe(499));
    expect(result.current.hasMore).toBe(true);

    await act(async () => { await result.current.loadMore(); }); // page 500
    expect(result.current.hasMore).toBe(false);
    await act(async () => { await result.current.loadMore(); }); // must be a no-op
    expect(fetchPage).not.toHaveBeenCalledWith(501);
    expect(Math.max(...fetchPage.mock.calls.map(([p]) => p))).toBe(500);
  });
});
