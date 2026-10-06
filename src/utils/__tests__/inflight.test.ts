import { createInflight } from "../inflight";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("createInflight", () => {
  it("returns the pending promise for a repeated key", async () => {
    const { run } = createInflight();
    const d = deferred<number>();
    const fn = jest.fn(() => d.promise);
    const a = run("k", fn);
    const b = run("k", fn);
    expect(fn).toHaveBeenCalledTimes(1);
    d.resolve(7);
    await expect(a).resolves.toBe(7);
    await expect(b).resolves.toBe(7);
  });

  it("runs independent keys separately", () => {
    const { run } = createInflight();
    const fn = jest.fn(() => new Promise<void>(() => {}));
    run("a", fn);
    run("b", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clears the key after rejection so a retry runs", async () => {
    const { run } = createInflight();
    const d = deferred();
    const first = run("k", () => d.promise);
    d.reject(new Error("boom"));
    await expect(first).rejects.toThrow("boom");
    const fn = jest.fn(() => Promise.resolve());
    await run("k", fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("shares a rejection with the repeated caller", async () => {
    const { run } = createInflight();
    const d = deferred();
    const a = run("k", () => d.promise);
    const b = run("k", () => Promise.resolve());
    d.reject(new Error("nope"));
    await expect(a).rejects.toThrow("nope");
    await expect(b).rejects.toThrow("nope");
  });
});
