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
