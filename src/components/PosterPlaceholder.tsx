import type { CSSProperties } from "react";
import { FONT_SIZE } from "../constants/typography";

interface Props {
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function PosterPlaceholder({ className, style, onClick }: Props) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a2e",
        color: "#555",
        fontSize: FONT_SIZE.caption,
        ...style,
      }}
    >
      No Image
    </div>
  );
}
