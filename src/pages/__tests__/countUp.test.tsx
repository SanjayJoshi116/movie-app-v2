import { renderHook } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import { useCountUp } from "../StatsPage";

// accessibility spec: with reduced motion the Stats numbers show their final
// value at once instead of counting up.
jest.mock("framer-motion", () => ({ ...jest.requireActual("framer-motion"), useReducedMotion: jest.fn() }));

const mockReduced = useReducedMotion as jest.Mock;

it("shows the final value at once under reduced motion", () => {
  mockReduced.mockReturnValue(true);
  const { result } = renderHook(() => useCountUp(42));
  expect(result.current).toBe(42);
});

it("counts up from zero when motion is allowed", () => {
  mockReduced.mockReturnValue(false);
  const { result } = renderHook(() => useCountUp(42));
  expect(result.current).toBe(0);
});
