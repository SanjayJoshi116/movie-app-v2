import { downloadBlob } from "../export";

// data-backup: downloads aren't cut short by revoking the URL too early.

beforeEach(() => {
  jest.useFakeTimers();
  URL.createObjectURL = jest.fn(() => "blob:test");
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => jest.useRealTimers());

it("clicks an attached anchor, removes it, and revokes the URL only after a tick", () => {
  const clicks: { href: string; download: string; attached: boolean }[] = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ href: this.href, download: this.download, attached: document.body.contains(this) });
  });

  downloadBlob(new Blob(["a,b"], { type: "text/csv" }), "export.csv");

  expect(clicks).toEqual([{ href: "blob:test", download: "export.csv", attached: true }]);
  expect(document.querySelectorAll("a").length).toBe(0);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  jest.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
});
