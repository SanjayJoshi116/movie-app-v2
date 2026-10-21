import type { CSSProperties, ReactNode } from "react";
import { theme } from "antd";
import { FONT_SIZE } from "../constants/typography";

interface Props {
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  /** What stands in for the image: "No Image" unless given. */
  children?: ReactNode;
  "aria-hidden"?: boolean;
}

export function PosterPlaceholder({ className, style, onClick, children = "No Image", "aria-hidden": ariaHidden }: Props) {
  const { token } = theme.useToken();
  return (
    <div
      className={className}
      onClick={onClick}
      aria-hidden={ariaHidden}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: token.colorFillSecondary,
        color: token.colorTextSecondary,
        fontSize: FONT_SIZE.caption,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
