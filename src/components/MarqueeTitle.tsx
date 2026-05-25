import React, { useLayoutEffect, useRef, useState } from "react";

interface Props {
  children: string;
  style?: React.CSSProperties;
}

export default function MarqueeTitle({ children, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [hovered, setHovered] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (container && text) {
      const d = text.scrollWidth - container.offsetWidth;
      setDistance(d > 0 ? d : 0);
    }
  }, [children]);

  return (
    <div
      ref={containerRef}
      style={{ overflow: "hidden", whiteSpace: "nowrap", ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={textRef}
        style={{
          display: "inline-block",
          transform: hovered && distance > 0 ? `translateX(-${distance}px)` : "translateX(0)",
          transition:
            hovered && distance > 0
              ? `transform ${Math.min(distance * 25, 3000)}ms linear`
              : "transform 0.4s ease",
        }}
      >
        {children}
      </span>
    </div>
  );
}
