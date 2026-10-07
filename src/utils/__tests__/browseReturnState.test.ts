import { stashReturnState } from "../browseReturnState";

describe("stashReturnState", () => {
  it("merges into the router's usr state and keeps key/idx", () => {
    window.history.replaceState({ usr: { from: "/x" }, key: "abc", idx: 3 }, "");
    stashReturnState({ isReturn: true, scrollY: 400 });
    expect(window.history.state).toEqual({
      usr: { from: "/x", isReturn: true, scrollY: 400 },
      key: "abc",
      idx: 3,
    });
  });

  it("handles an entry with no prior state", () => {
    window.history.replaceState(null, "");
    stashReturnState({ isReturn: true });
    expect(window.history.state).toEqual({ usr: { isReturn: true } });
  });
});
