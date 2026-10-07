import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

interface CardLinkProps {
  /** Real href: Tab/Enter, new-tab clicks and the browser's link preview use it. */
  to: string;
  state?: unknown;
  /**
   * Called instead of following `to` on a plain left click or Enter, so callers
   * can build router state at click time (scroll position, return stash).
   * Modifier and middle clicks still open `to` natively in a new tab/window.
   */
  onNavigate?: () => void;
  /** Set when an ancestor also handles clicks, so one click doesn't navigate twice. */
  stopPropagation?: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}

const isPlainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** A card or thumbnail that opens a page: a real, keyboard-reachable link. */
export default function CardLink({ to, state, onNavigate, stopPropagation, label, className, children }: CardLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) e.stopPropagation();
    if (onNavigate && isPlainClick(e)) {
      e.preventDefault();
      onNavigate();
    }
  };

  return (
    <Link
      to={to}
      state={state}
      aria-label={label}
      className={className ? `card-link ${className}` : "card-link"}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
