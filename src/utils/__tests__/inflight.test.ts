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

  it("dedupes a repeat of the same action", async () => {
    const { run } = createInflight();
    const d = deferred<string>();
    const fn = jest.fn(() => d.promise);
    const a = run("k", fn, "add");
    const b = run("k", fn, "add");
    expect(fn).toHaveBeenCalledTimes(1);
    d.resolve("added");
    await expect(Promise.all([a, b])).resolves.toEqual(["added", "added"]);
  });

  it("runs a different action after the pending one, with its own outcome", async () => {
    const { run } = createInflight();
    const add = deferred<string>();
    const remove = jest.fn(async () => "removed");
    const a = run("k", () => add.promise, "add");
    const r = run("k", remove, "remove");
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
    add.resolve("added");
    await expect(a).resolves.toBe("added");
    await expect(r).resolves.toBe("removed");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("still runs the queued action when the first one fails", async () => {
    const { run } = createInflight();
    const add = deferred<string>();
    const a = run("k", () => add.promise, "add");
    const r = run("k", async () => "removed", "remove");
    add.reject(new Error("500"));
    await expect(a).rejects.toThrow("500");
    await expect(r).resolves.toBe("removed");
  });

  it("an exclusive run waits for pending runs, and new runs wait for it", async () => {
    const order: string[] = [];
    const { run, runExclusive } = createInflight();
    const add = deferred();
    const clear = deferred();
    const a = run("t1", async () => { await add.promise; order.push("add"); }, "add");
    const c = runExclusive(async () => { order.push("clear-start"); await clear.promise; order.push("clear"); });
    const b = run("t2", async () => { order.push("add2"); }, "add");
    await Promise.resolve();
    expect(order).toEqual([]);
    add.resolve();
    await a;
    await waitTicks();
    expect(order).toEqual(["add", "clear-start"]);
    clear.resolve();
    await Promise.all([c, b]);
    expect(order).toEqual(["add", "clear-start", "clear", "add2"]);
  });

  it("dedupes a repeated exclusive run", async () => {
    const { runExclusive } = createInflight();
    const fn = jest.fn(() => new Promise<void>(() => {}));
    runExclusive(fn);
    runExclusive(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("groups are independent, and onSettle fires for every run", async () => {
    const onSettle = jest.fn();
    const inflight = createInflight({ onSettle });
    const blocked = deferred();
    inflight.group(1).runExclusive(() => blocked.promise);
    const other = jest.fn(async () => undefined);
    await inflight.group(2).run("x", other, "add");
    expect(other).toHaveBeenCalledTimes(1);
    blocked.resolve();
    await inflight.whenIdle();
    expect(onSettle).toHaveBeenCalledTimes(2);
  });
});

async function waitTicks(n = 5) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}
