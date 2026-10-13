import { Typography } from "antd";
import { FONT_SIZE } from "../constants/typography";

/** "Looking up posters: n / total" while an import's paced lookups run. */
export function ImportProgress({ progress }: { progress: { done: number; total: number } | null }) {
  if (!progress || progress.total === 0) return null;
  return (
    <Typography.Text
      type="secondary"
      role="status"
      style={{ display: "block", marginBottom: 8, fontSize: FONT_SIZE.caption }}
    >
      Looking up posters: {progress.done} / {progress.total}
    </Typography.Text>
  );
}
