import { renderHook } from "@testing-library/react";
import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { UIProvider } from "../../context/UIContext";
import { darkThemeConfig, lightThemeConfig } from "../../theme/antdTheme";
import { RATING_GOLD } from "../../constants/ui";
import { useActionIconColor } from "../useActionIconColor";

function wrapperFor(theme: "dark" | "light") {
  localStorage.setItem("cinedb_theme", JSON.stringify(theme));
  return ({ children }: { children: ReactNode }) => (
    <UIProvider>
      <ConfigProvider theme={theme === "dark" ? darkThemeConfig : lightThemeConfig}>{children}</ConfigProvider>
    </UIProvider>
  );
}

afterEach(() => localStorage.clear());

test("dark mode: the gold accent", () => {
  const { result } = renderHook(() => useActionIconColor(), { wrapper: wrapperFor("dark") });
  expect(result.current).toBe(RATING_GOLD);
});

test("light mode: the light theme's text color, not pure black", () => {
  const { result } = renderHook(() => useActionIconColor(), { wrapper: wrapperFor("light") });
  expect(result.current).toBe(lightThemeConfig.token?.colorText);
  expect(result.current).not.toBe("#000000");
});
