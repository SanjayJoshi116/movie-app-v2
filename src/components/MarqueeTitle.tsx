import React, { useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface Props {
  children: string;
  style?: React.CSSProperties;
}

/**
 * A card title that fits its card: an ellipsis marks a cut, and the full
 * title is its tooltip text (touch and keyboard users can't hover to read it).
 * Re-measured when the card's width changes. With motion allowed, hovering a
 * cut title scrolls it into view.
 */
export default function MarqueeTitle({ children, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    const measure = () => {
      const d = text.scrollWidth - container.offsetWidth;
      setDistance(d > 0 ? d : 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children]);

  const scrolling = hovered && distance > 0 && !reduceMotion;

  return (
    <div
      ref={containerRef}
      title={distance > 0 ? children : undefined}
      style={{ overflow: "hidden", whiteSpace: "nowrap", ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={textRef}
        data-testid="marquee-text"
        style={{
          display: "inline-block",
          // At rest the text is cut with an ellipsis; while scrolling it shows whole.
          maxWidth: scrolling ? "none" : "100%",
          overflow: scrolling ? "visible" : "hidden",
          textOverflow: "ellipsis",
          verticalAlign: "bottom",
          transform: scrolling ? `translateX(-${distance}px)` : "translateX(0)",
          transition: scrolling
            ? `transform ${Math.min(distance * 25, 3000)}ms linear`
            : "transform 0.4s ease",
        }}
      >
        {children}
      </span>
    </div>
  );
}
