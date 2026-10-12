import { Button, theme } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { FONT_SIZE } from "../constants/typography";
import { getApiError } from "../utils/apiError";

interface Props {
  error: unknown;
  onRetry: () => void;
}

/**
 * Shown under an infinite-scroll grid whose next page failed. Auto-loading
 * stays off until the user retries, so a failing source isn't re-requested
 * in a loop while the end of the grid is in view.
 */
export function LoadMoreError({ error, onRetry }: Props) {
  const { token } = theme.useToken();
  return (
    <div role="alert" style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ color: token.colorTextSecondary, fontSize: FONT_SIZE.body, marginBottom: 12 }}>
        {getApiError(error, "Couldn't load more results.")}
      </div>
      <Button icon={<ReloadOutlined />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
