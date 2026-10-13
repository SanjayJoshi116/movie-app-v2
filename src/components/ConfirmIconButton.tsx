import { useState, type CSSProperties, type ReactNode } from "react";
import { Button, Popconfirm, Tooltip } from "antd";

interface Props {
  /** The confirmation's question, e.g. "Mark as unwatched?". */
  title: string;
  okText: string;
  onConfirm: () => void | Promise<void>;
  /** Hover label for the icon. */
  tooltip: string;
  ariaLabel: string;
  icon: ReactNode;
  danger?: boolean;
  style?: CSSProperties;
}

/**
 * An icon button whose action needs confirming. The icon's Tooltip is hidden
 * while the Popconfirm is open: left to itself it stays up (and on touch
 * screens it never closes), covering the confirm button.
 */
export function ConfirmIconButton({ title, okText, onConfirm, tooltip, ariaLabel, icon, danger, style }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Popconfirm
      title={title}
      onConfirm={onConfirm}
      okText={okText}
      cancelText="Cancel"
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
    >
      <Tooltip title={tooltip} open={confirmOpen ? false : undefined}>
        <Button
          type="text"
          danger={danger}
          size="small"
          icon={icon}
          style={style}
          // The card around it opens the title on click.
          onClick={(e) => e.stopPropagation()}
          aria-label={ariaLabel}
        />
      </Tooltip>
    </Popconfirm>
  );
}
