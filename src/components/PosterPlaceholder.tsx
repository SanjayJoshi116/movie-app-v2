import type { CSSProperties } from "react";
import { theme } from "antd";
import { FONT_SIZE } from "../constants/typography";

interface Props {
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function PosterPlaceholder({ className, style, onClick }: Props) {
  const { token } = theme.useToken();
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: token.colorFillSecondary,
        color: token.colorTextTertiary,
        fontSize: FONT_SIZE.caption,
        ...style,
      }}
    >
      No Image
    </div>
  );
}
