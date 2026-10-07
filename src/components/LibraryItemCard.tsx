import { memo } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card } from "antd";
import MarqueeTitle from "./MarqueeTitle";
import { IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { PosterPlaceholder } from "./PosterPlaceholder";
import CardLink from "./CardLink";

interface Props {
  posterPath: string | null;
  title: string;
  /** Detail-page path: the poster link's real href (keyboard, new tab). */
  to: string;
  /** Plain-click/Enter navigation, so callers can pass click-time router state. */
  onOpen: () => void;
  tags?: ReactNode;
  actionButtons?: ReactNode;
  footer?: ReactNode;
}

const LibraryItemCard = ({ posterPath, title, to, onOpen, tags, actionButtons, footer }: Props) => {
  return (
    <motion.div
      role="article"
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ height: "100%" }}
    >
      <Card
        hoverable
        className="glass-card"
        style={{ height: "100%" }}
        cover={
          // Poster-only link: the action buttons must stay outside it.
          <CardLink to={to} onNavigate={onOpen} label={`Open ${title}`}>
            {posterPath ? (
              <img src={`${IMG_URL}${posterPath}`} alt={title} loading="lazy" className="movie-poster-img" />
            ) : (
              <PosterPlaceholder className="movie-poster-img" />
            )}
          </CardLink>
        }
        styles={{ body: { padding: "10px 12px" } }}
      >
        <Card.Meta
          title={
            <MarqueeTitle style={{ fontSize: FONT_SIZE.emphasis, lineHeight: "1.3" }}>{title}</MarqueeTitle>
          }
          description={
            (tags || actionButtons) && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 8 }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{tags}</div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{actionButtons}</div>
              </div>
            )
          }
        />
        {footer}
      </Card>
    </motion.div>
  );
};

export default memo(LibraryItemCard);
