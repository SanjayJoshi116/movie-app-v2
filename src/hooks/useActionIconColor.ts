import { theme as antdTheme } from "antd";
import { useUIContext } from "../context/UIContext";
import { RATING_GOLD } from "../constants/ui";

/** Color of an idle (not watched, not in watchlist) action icon: the gold
 *  accent in dark mode, the theme's text color in light mode. */
export function useActionIconColor(): string {
  const { theme } = useUIContext();
  const { token } = antdTheme.useToken();
  return theme === "dark" ? RATING_GOLD : token.colorText;
}
