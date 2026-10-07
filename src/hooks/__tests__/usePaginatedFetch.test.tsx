import React from "react";
import { App } from "antd";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePaginatedFetch, PageResult } from "../usePaginatedFetch";

type Item = { id: number };

const noRestore = { isReturning: false, savedLoadedPages: 1, savedScrollY: 0 };
const wrapper = ({ children }: { children: React.ReactNode }) => <App>{children}</App>;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const page = (ids: number[], totalPages = 5): PageResult<Item> => ({ results: ids.map((id) => ({ id })), totalPages });

describe("usePaginatedFetch", () => {
  it("sets error when page 1 fails, and retry refetches", async () => {
    const fetchPage = jest.fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(page([1, 2]));
    const { result } = renderHook(() => usePaginatedFetch<Item>({ fetchPage, restore: noRestore }), { wrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.items).toEqual([]);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("clears the previous query's items when fetchPage changes", async () => {
    const second = deferred<PageResult<Item>>();
    const fetchA = jest.fn().mockResolvedValue(page([1, 2]));
    const fetchB = jest.fn().mockReturnValue(second.promise);
    const { result, rerender } = renderHook(
      ({ fetchPage }) => usePaginatedFetch<Item>({ fetchPage, restore: noRestore }),
      { wrapper, initialProps: { fetchPage: fetchA } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    rerender({ fetchPage: fetchB });
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.loading).toBe(true);

    await act(async () => { second.resolve(page([9])); });
    expect(result.current.items).toEqual([{ id: 9 }]);
  });

  it("discards a loadMore response that arrives after the query changed", async () => {
    const stale = deferred<PageResult<Item>>();
    const fetchA = jest.fn()
      .mockResolvedValueOnce(page([1, 2]))
      .mockReturnValueOnce(stale.promise);
    const fetchB = jest.fn().mockResolvedValue(page([10], 1));
    const { result, rerender } = renderHook(
      ({ fetchPage }) => usePaginatedFetch<Item>({ fetchPage, restore: noRestore }),
      { wrapper, initialProps: { fetchPage: fetchA } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    let more: Promise<void> | undefined;
    act(() => { more = result.current.loadMore(); });
    rerender({ fetchPage: fetchB });
    await waitFor(() => expect(result.current.items).toEqual([{ id: 10 }]));

    await act(async () => { stale.resolve(page([3, 4])); await more; });
    expect(result.current.items).toEqual([{ id: 10 }]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.currentPage).toBe(1);
  });

  it("seeds restored state without fetching or clearing it", async () => {
    const fetchPage = jest.fn();
    const restore = { isReturning: true, savedLoadedPages: 3, savedScrollY: 0 };
    const { result } = renderHook(
      () => usePaginatedFetch<Item>({ fetchPage, restore, restoredState: { items: [{ id: 1 }, { id: 2 }], hasMore: true } }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.currentPage).toBe(3);
  });
});

// StrictMode (dev only) runs the mount effect, its cleanup and the effect
// again. The replay must not start a second load.
describe("usePaginatedFetch under StrictMode", () => {
  const strictWrapper = ({ children }: { children: React.ReactNode }) => (
    <React.StrictMode><App>{children}</App></React.StrictMode>
  );

  it("requests page 1 once on a fresh load", async () => {
    const fetchPage = jest.fn().mockResolvedValue(page([1, 2]));
    const { result } = renderHook(() => usePaginatedFetch<Item>({ fetchPage, restore: noRestore }), { wrapper: strictWrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it("requests each restored page once", async () => {
    const fetchPage = jest.fn((p: number) => Promise.resolve(page([p * 10, p * 10 + 1])));
    const restore = { isReturning: true, savedLoadedPages: 3, savedScrollY: 0 };
    const { result } = renderHook(() => usePaginatedFetch<Item>({ fetchPage, restore }), { wrapper: strictWrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(result.current.currentPage).toBe(3);
  });

  it("sets no state after unmounting during the pending load", async () => {
    const pending = deferred<PageResult<Item>>();
    const fetchPage = jest.fn().mockReturnValue(pending.promise);
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => usePaginatedFetch<Item>({ fetchPage, restore: noRestore }), { wrapper: strictWrapper });
    expect(result.current.loading).toBe(true);
    unmount();
    await act(async () => { pending.resolve(page([1])); });
    expect(result.current.items).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("starts a new load when fetchPage changes", async () => {
    const fetchA = jest.fn().mockResolvedValue(page([1]));
    const fetchB = jest.fn().mockResolvedValue(page([2]));
    const { result, rerender } = renderHook(
      ({ fetchPage }) => usePaginatedFetch<Item>({ fetchPage, restore: noRestore }),
      { wrapper: strictWrapper, initialProps: { fetchPage: fetchA } },
    );
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1 }]));
    rerender({ fetchPage: fetchB });
    await waitFor(() => expect(result.current.items).toEqual([{ id: 2 }]));
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);
  });
});
