import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

const commonTokens = {
  colorPrimary: "#f5c518",
  fontFamily: "'Poppins', sans-serif",
  borderRadius: 8,
  borderRadiusLG: 12,
  fontSize: 14,
  fontSizeHeading2: 30,
  fontSizeHeading4: 20,
};

export const darkThemeConfig: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...commonTokens,
    colorBgBase: "#0d0f1a",
    colorBgContainer: "#1a1d2e",
    colorBgElevated: "#22254b",
    colorBgLayout: "#0d0f1a",
    colorText: "#e8e8e8",
    colorTextSecondary: "#a0a0b8",
    colorBorder: "#2d3060",
    colorBorderSecondary: "#232645",
  },
  components: {
    Layout: {
      headerBg: "#14172a",
      bodyBg: "#0d0f1a",
    },
    Card: {
      colorBgContainer: "rgba(26, 29, 46, 0.72)",
    },
    Drawer: {
      colorBgElevated: "rgba(26, 29, 46, 0.92)",
    },
    Table: {
      colorBgContainer: "#1a1d2e",
      headerBg: "#22254b",
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
    },
  },
};

export const lightThemeConfig: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...commonTokens,
    colorBgBase: "#f0f2f5",
    colorBgContainer: "#ffffff",
    colorBgLayout: "#f0f2f5",
  },
  components: {
    Layout: {
      headerBg: "#1a1d2e",
      bodyBg: "#f0f2f5",
    },
    Card: {
      colorBgContainer: "rgba(255, 255, 255, 0.75)",
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
    },
  },
};
