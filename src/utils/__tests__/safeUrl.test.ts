import { safeHttpUrl } from "../safeUrl";

describe("safeHttpUrl", () => {
  it("keeps absolute http and https URLs", () => {
    expect(safeHttpUrl("https://example.com/me")).toBe("https://example.com/me");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it.each([
    // eslint-disable-next-line no-script-url -- hostile input under test
    "javascript:alert(1)",
    "  JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "/relative/path",
    "example.com",
    "//example.com",
    "not a url",
    "",
    null,
    undefined,
  ])("rejects %p", (value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });
});
