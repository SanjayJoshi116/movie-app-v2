import { goBack } from "../goBack";

const setHistoryState = (state: unknown) => window.history.replaceState(state, "");

afterEach(() => setHistoryState(null));

it("returns to `from` with its state when the app opened the page", () => {
  const navigate = jest.fn();
  setHistoryState({ idx: 0 });
  goBack(navigate, { from: "/following", state: { isReturn: true }, fallback: "/movies" });
  expect(navigate).toHaveBeenCalledWith("/following", { state: { isReturn: true } });
});

it("goes back in history when there is an earlier in-app entry", () => {
  const navigate = jest.fn();
  setHistoryState({ idx: 3 });
  goBack(navigate, { fallback: "/movies" });
  expect(navigate).toHaveBeenCalledWith(-1);
});

it("goes to the section, replacing, on the tab's first entry", () => {
  const navigate = jest.fn();
  setHistoryState({ idx: 0 });
  goBack(navigate, { fallback: "/tv" });
  expect(navigate).toHaveBeenCalledWith("/tv", { replace: true });
});

it("goes to the section when history has no router state at all", () => {
  const navigate = jest.fn();
  setHistoryState(null);
  goBack(navigate, { from: null, fallback: "/people" });
  expect(navigate).toHaveBeenCalledWith("/people", { replace: true });
});
