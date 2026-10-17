import { theme } from "antd";
import { darkThemeConfig, lightThemeConfig } from "../antdTheme";
import { ON_GOLD_TEXT } from "../../constants/ui";

// theme-readability spec: secondary and tertiary text reach WCAG AA (4.5:1)
// on every page, card and popup background of both themes.
const TEXT_AA = 4.5;

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.replace(/./g, "$&$&");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(rgb(a));
  const lb = luminance(rgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe.each([
  ["light", lightThemeConfig],
  ["dark", darkThemeConfig],
])("%s theme", (_name, config) => {
  const t = config.token as Record<string, string | undefined>;
  const backgrounds = [t.colorBgLayout, t.colorBgContainer, t.colorBgElevated];

  it.each(["colorTextSecondary", "colorTextTertiary"])("%s is at least 4.5:1 on every background", (token) => {
    const color = t[token] ?? "";
    expect(color).toMatch(/^#[0-9a-f]{6}$/i); // set explicitly, not derived
    for (const bg of backgrounds) {
      expect(contrast(color, bg ?? "")).toBeGreaterThanOrEqual(TEXT_AA);
    }
  });

  // As rendered: the dark algorithm re-derives colorLink from its seed (gold
  // becomes the same #d3aa17 as the dark theme's primary), so read the result.
  it.each(["colorLink", "colorLinkHover", "colorLinkActive"] as const)("%s is at least 4.5:1 on every background", (token) => {
    const color = theme.getDesignToken(config)[token];
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const bg of backgrounds) {
      expect(contrast(color, bg ?? "")).toBeGreaterThanOrEqual(TEXT_AA);
    }
  });

  it("primary button text is at least 4.5:1 on the button at rest, hover and active", () => {
    const derived = theme.getDesignToken(config);
    expect(config.components?.Button?.primaryColor).toBe(ON_GOLD_TEXT);
    for (const fill of [derived.colorPrimary, derived.colorPrimaryHover, derived.colorPrimaryActive]) {
      expect(contrast(ON_GOLD_TEXT, fill)).toBeGreaterThanOrEqual(TEXT_AA);
    }
  });
});
