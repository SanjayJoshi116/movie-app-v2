import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "../useLocalStorage";

beforeEach(() => {
  localStorage.clear();
});

describe("useLocalStorage", () => {
  it("returns initialValue when storage is empty", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", 42));
    expect(result.current[0]).toBe(42);
  });

  it("returns parsed stored value on mount", () => {
    localStorage.setItem("test-key", JSON.stringify("hello"));
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("hello");
  });

  it("setValue updates state and writes to localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", 0));
    act(() => {
      result.current[1](99);
    });
    expect(result.current[0]).toBe(99);
    expect(JSON.parse(localStorage.getItem("test-key")!)).toBe(99);
  });

  it("setValue accepts updater function (prev => next)", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", 10));
    act(() => {
      result.current[1]((prev) => prev + 5);
    });
    expect(result.current[0]).toBe(15);
    expect(JSON.parse(localStorage.getItem("test-key")!)).toBe(15);
  });

  it("handles corrupted JSON — returns initialValue, does not throw", () => {
    localStorage.setItem("test-key", "not-valid-json{{{");
    const { result } = renderHook(() => useLocalStorage("test-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("multiple keys are independent", () => {
    const { result: a } = renderHook(() => useLocalStorage("key-a", 1));
    const { result: b } = renderHook(() => useLocalStorage("key-b", 2));
    act(() => {
      a.current[1](100);
    });
    expect(a.current[0]).toBe(100);
    expect(b.current[0]).toBe(2);
  });
});

describe("useLocalStorage same-tab sync", () => {
  it("updates another instance on the same key", () => {
    const { result: a } = renderHook(() => useLocalStorage<string[]>("shared-key", []));
    const { result: b } = renderHook(() => useLocalStorage<string[]>("shared-key", []));
    act(() => a.current[1](["Dune"]));
    expect(b.current[0]).toEqual(["Dune"]);
  });

  it("lets an updater in one instance build on another's write", () => {
    const { result: a } = renderHook(() => useLocalStorage<string[]>("shared-key", []));
    const { result: b } = renderHook(() => useLocalStorage<string[]>("shared-key", []));
    act(() => a.current[1]((prev) => ["Dune", ...prev]));
    act(() => b.current[1]((prev) => ["Arrival", ...prev]));
    expect(a.current[0]).toEqual(["Arrival", "Dune"]);
    expect(JSON.parse(localStorage.getItem("shared-key")!)).toEqual(["Arrival", "Dune"]);
  });

  it("leaves other keys alone", () => {
    const { result: a } = renderHook(() => useLocalStorage("key-a", 1));
    const { result: b } = renderHook(() => useLocalStorage("key-b", 1));
    act(() => a.current[1](2));
    expect(b.current[0]).toBe(1);
  });

  it("chains back-to-back updaters in one tick", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));
    act(() => {
      result.current[1]((n) => n + 1);
      result.current[1]((n) => n + 1);
    });
    expect(result.current[0]).toBe(2);
  });
});

test("the setter keeps its identity across renders (fix-session-sweep-f1)", () => {
  const { result, rerender } = renderHook(() => useLocalStorage("cinedb_stable", 1));
  const first = result.current[1];
  act(() => result.current[1](2));
  rerender();
  expect(result.current[1]).toBe(first);
  expect(result.current[0]).toBe(2);
});
