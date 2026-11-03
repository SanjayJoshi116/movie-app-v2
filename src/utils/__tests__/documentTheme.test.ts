import { applyDocumentTheme, readStoredTheme, THEME_STORAGE_KEY } from "../documentTheme";
import { darkThemeConfig, lightThemeConfig } from "../../theme/antdTheme";

// fix-shell-sweep-f5 (theme-readability): the saved theme is on the page
// before React renders, and the browser's own UI follows it.

let meta: HTMLMetaElement;
beforeEach(() => {
  meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = "#000000";
  document.head.appendChild(meta);
});
afterEach(() => {
  meta.remove();
  document.body.classList.remove("dark-theme");
  document.documentElement.style.colorScheme = "";
  localStorage.removeItem(THEME_STORAGE_KEY);
});

it.each([
  ["dark", true, darkThemeConfig.token?.colorBgLayout],
  ["light", false, lightThemeConfig.token?.colorBgLayout],
] as const)("puts the page and browser UI in the %s theme", (theme, darkClass, background) => {
  applyDocumentTheme(theme);
  expect(document.body.classList.contains("dark-theme")).toBe(darkClass);
  expect(document.documentElement.style.colorScheme).toBe(theme);
  expect(meta.content).toBe(background);
});

it("switches back and forth", () => {
  applyDocumentTheme("light");
  applyDocumentTheme("dark");
  expect(document.body.classList.contains("dark-theme")).toBe(true);
  expect(document.documentElement.style.colorScheme).toBe("dark");
});

describe("readStoredTheme", () => {
  it("reads the JSON value useLocalStorage writes", () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify("light"));
    expect(readStoredTheme()).toBe("light");
  });

  it.each([
    ["missing", null],
    ["a bare string (not JSON)", "light"],
    ["an unknown value", JSON.stringify("sepia")],
  ])("falls back to dark when %s", (_label, raw) => {
    if (raw !== null) localStorage.setItem(THEME_STORAGE_KEY, raw);
    expect(readStoredTheme()).toBe("dark");
  });
});
