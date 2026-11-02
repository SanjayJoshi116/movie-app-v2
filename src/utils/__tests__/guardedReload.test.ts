import { guardedReload } from "../guardedReload";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("guardedReload newest-reload rule (fix-hooks-sweep-f2)", () => {
  it("drops an older reload that finishes after a newer one", async () => {
    const writeSeq = { current: 0 };
    const reloadSeq = { current: 0 };
    const applied: string[] = [];
    const onSettled = jest.fn();
    const older = deferred<string>();
    const newer = deferred<string>();
    const first = guardedReload(writeSeq, () => older.promise, (d) => applied.push(d), { reloadSeq, onSettled });
    const second = guardedReload(writeSeq, () => newer.promise, (d) => applied.push(d), { reloadSeq, onSettled });
    newer.resolve("new");
    await second;
    older.resolve("old");
    await first;
    expect(applied).toEqual(["new"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("an older reload's failure after a newer success isn't rethrown", async () => {
    const writeSeq = { current: 0 };
    const reloadSeq = { current: 0 };
    const onSettled = jest.fn();
    const older = deferred<string>();
    const first = guardedReload(writeSeq, () => older.promise, () => undefined, { reloadSeq, onSettled });
    await guardedReload(writeSeq, async () => "new", () => undefined, { reloadSeq, onSettled });
    older.reject(new Error("boom"));
    await expect(first).resolves.toBeUndefined();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("a superseded reload settles with the newest one's failure", async () => {
    const reloadSeq = { current: 0 };
    const older = deferred<string>();
    const newer = deferred<string>();
    const first = guardedReload({ current: 0 }, () => older.promise, () => undefined, { reloadSeq });
    const second = guardedReload({ current: 0 }, () => newer.promise, () => undefined, { reloadSeq });
    older.resolve("old");
    newer.reject(new Error("newest failed"));
    await expect(second).rejects.toThrow("newest failed");
    await expect(first).rejects.toThrow("newest failed");
  });

  it("a chain of superseded reloads follows the last one", async () => {
    const reloadSeq = { current: 0 };
    const applied: string[] = [];
    const ds = [deferred<string>(), deferred<string>(), deferred<string>()];
    const calls = ds.map((d) => guardedReload({ current: 0 }, () => d.promise, (v) => applied.push(v), { reloadSeq }));
    ds[0]!.resolve("a");
    ds[1]!.resolve("b");
    ds[2]!.resolve("c");
    await Promise.all(calls);
    expect(applied).toEqual(["c"]);
  });

  it("the newest reload's failure is rethrown", async () => {
    const onSettled = jest.fn();
    await expect(guardedReload({ current: 0 }, () => Promise.reject(new Error("boom")), () => undefined,
      { reloadSeq: { current: 0 }, onSettled })).rejects.toThrow("boom");
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("reruns when a write settled mid-load, and applies after maxRetries", async () => {
    const writeSeq = { current: 0 };
    const fetch = jest.fn(async () => { writeSeq.current += 1; return writeSeq.current; });
    const apply = jest.fn();
    await guardedReload(writeSeq, fetch, apply, { reloadSeq: { current: 0 }, maxRetries: 2 });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(apply).toHaveBeenCalledWith(3);
  });
});
