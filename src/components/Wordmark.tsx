import { Typography } from "antd";
import { FONT_SIZE } from "../constants/typography";

interface WordmarkProps {
  /** Heading level: 1 where the wordmark is the page's main heading. */
  level?: 1 | 2 | 3 | 4 | 5;
  /** Omitted: the heading level's own size from the theme. */
  size?: keyof typeof FONT_SIZE;
  className?: string;
}

/** The "CINE DB" wordmark. Its color is theme-scoped in App.css (`.wordmark`):
 *  gold on the dark theme, brass on the light one, where gold fails contrast. */
export function Wordmark({ level = 1, size, className }: WordmarkProps) {
  return (
    <Typography.Title
      level={level}
      className={className ? `wordmark ${className}` : "wordmark"}
      style={size ? { fontSize: FONT_SIZE[size], margin: 0 } : { margin: 0 }}
    >
      CINE DB
    </Typography.Title>
  );
}
