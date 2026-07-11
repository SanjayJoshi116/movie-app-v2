import type { ReactNode } from "react";
import { Tooltip, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

export function InfoTooltip({ title }: { title: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Tooltip title={title}>
      <InfoCircleOutlined style={{ marginLeft: 6, color: token.colorTextSecondary, cursor: "help" }} />
    </Tooltip>
  );
}
