import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Dropdown, Typography, Empty, Tooltip } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNotifications } from "../hooks/useNotifications";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { IMG_URL } from "../constants/ui";
import { formatDateDMY } from "../utils/formatDate";
import { FONT_SIZE } from "../constants/typography";

const THUMB_STYLE = { width: 32, height: 48, aspectRatio: "2 / 3", borderRadius: 4, flexShrink: 0, objectFit: "cover" as const };

interface Props {
  buttonClassName?: string;
}

function NotificationBell({ buttonClassName }: Props) {
  const navigate = useNavigate();
  const { items, unreadCount, hasError, markSeen } = useNotifications();
  const [open, setOpen] = useState(false);
  // Keys of items that were unread when the dropdown opened. Rendering bold
  // from this snapshot (and marking seen only on close) means the user actually
  // sees which items are new before the server forgets.
  const [unreadSnapshot, setUnreadSnapshot] = useState<Set<string>>(new Set());

  const itemKey = (item: (typeof items)[number]) => `${item.type}-${item.id}`;

  const setOpenState = (visible: boolean) => {
    setOpen(visible);
    if (visible) {
      setUnreadSnapshot(new Set(items.filter((i) => i.isUnread).map(itemKey)));
    } else {
      if (unreadCount > 0 || unreadSnapshot.size > 0) markSeen();
      setUnreadSnapshot(new Set());
    }
  };

  const openItem = (item: (typeof items)[number]) => {
    setOpenState(false);
    navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`);
  };

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpenState}
      trigger={["click"]}
      getPopupContainer={(triggerNode) => (triggerNode.parentElement as HTMLElement) ?? document.body}
      popupRender={() => (
        <div
          className="glass-overlay-card"
          style={{ width: 320, maxHeight: 420, overflowY: "auto", padding: 8, borderRadius: 8 }}
        >
          <Typography.Text strong style={{ display: "block", padding: "4px 8px 8px" }}>
            New releases from people you follow
          </Typography.Text>
          {items.length === 0 ? (
            <Empty
              description={
                hasError ? (
                  <Typography.Text type="danger" style={{ fontSize: FONT_SIZE.caption }}>
                    Couldn't check for updates. Will retry automatically.
                  </Typography.Text>
                ) : (
                  "Nothing new in the last 30 days"
                )
              }
              style={{ padding: "24px 0" }}
            />
          ) : (
            items.map((item) => (
              <div
                key={itemKey(item)}
                role="button"
                tabIndex={0}
                onClick={() => openItem(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openItem(item);
                  }
                }}
                style={{ display: "flex", gap: 10, padding: 8, cursor: "pointer", borderRadius: 6, alignItems: "center" }}
              >
                {item.posterPath ? (
                  <img src={`${IMG_URL}${item.posterPath}`} alt={item.title} style={THUMB_STYLE} />
                ) : (
                  <PosterPlaceholder style={THUMB_STYLE} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text ellipsis style={{ display: "block", fontWeight: item.isUnread || unreadSnapshot.has(itemKey(item)) ? 700 : 400 }}>
                    {item.title}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption, display: "block" }}>
                    New from {item.personName} · {formatDateDMY(item.releaseDate)}
                  </Typography.Text>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    >
      <Tooltip title="Notifications">
        <Badge count={unreadCount} size="small" offset={[-2, 2]} overflowCount={99}>
          <Button
            type="text"
            icon={<BellOutlined />}
            aria-label="Notifications"
            className={buttonClassName}
            style={buttonClassName ? undefined : { padding: "0 4px" }}
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  );
}

export default NotificationBell;
