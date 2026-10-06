import { Result, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

interface Props {
  /** Render the 404 "not found" variant instead of the generic error. */
  notFound?: boolean;
  title?: string;
  subTitle?: string;
  onRetry?: () => void;
}

/** Shared failed-load / not-found state. Pass `onRetry` to offer an in-place refetch. */
export function LoadError({ notFound, title, subTitle, onRetry }: Props) {
  return (
    <Result
      status={notFound ? "404" : "error"}
      title={title ?? (notFound ? "Not found" : "Couldn't load this")}
      subTitle={subTitle ?? (notFound
        ? "It may have been removed, or the link is wrong."
        : "Check your connection and try again.")}
      extra={onRetry && !notFound ? (
        <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
          Retry
        </Button>
      ) : undefined}
    />
  );
}
