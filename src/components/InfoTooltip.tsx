import type { ReactNode } from "react";
import { Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

export function InfoTooltip({ title }: { title: ReactNode }) {
  return (
    <Tooltip title={title}>
      <InfoCircleOutlined style={{ marginLeft: 6, color: "rgba(0,0,0,0.45)", cursor: "help" }} />
    </Tooltip>
  );
}
