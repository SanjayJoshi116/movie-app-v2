import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Card, Button, Tag, Typography, Empty, Space, Popconfirm,
} from "antd";
import { StarFilled, DeleteOutlined, EditOutlined, BookOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import { RatingModal } from "../components/watchlist/RatingModal";
import WatchlistStats from "../components/watchlist/WatchlistStats";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const IMG_URL = "https://image.tmdb.org/t/p/w500";
const NO_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='%231a1a2e'/%3E%3Ctext x='150' y='225' text-anchor='middle' dominant-baseline='middle' fill='%23555' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E`;

interface RatingTarget {
  id: number;
  type: string;
  title: string;
}

function WatchlistPage() {
  const navigate = useNavigate();
  const { watchlist, removeFromWatchlist, getRating, setRating, allRatings } = useAppContext();
  const { showSuccess } = useToast();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      {watchlist.length > 0 && (
        <WatchlistStats watchlist={watchlist} allRatings={allRatings} />
      )}

      <Typography.Title level={2} style={{ marginBottom: 24 }}>
        My Watchlist ({watchlist.length})
      </Typography.Title>

      {watchlist.length === 0 ? (
        <Empty
          image={<BookOutlined style={{ fontSize: 48, color: "#f5c518" }} />}
          description="Your watchlist is empty. Browse movies and TV shows to add them."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/movies")}>Browse Movies</Button>
        </Empty>
      ) : (
        <Row gutter={[16, 20]}>
          {watchlist.map((item) => {
            const rating = getRating(item.id, item.type);
            return (
              <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4}>
                <Card
                  hoverable
                  cover={
                    <img
                      src={
                        item.posterPath
                          ? `${IMG_URL}${item.posterPath}`
                          : NO_IMAGE
                      }
                      alt={item.title}
                      className="movie-poster-img"
                      onClick={() =>
                        navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: '/watchlist' } })
                      }
                      style={{ cursor: "pointer" }}
                    />
                  }
                  bodyStyle={{ padding: "10px 12px" }}
                  actions={[
                    <Button
                      key="rate"
                      type="link"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() =>
                        setRatingTarget({ id: item.id, type: item.type, title: item.title })
                      }
                    >
                      {rating ? "Edit" : "Rate"}
                    </Button>,
                    <Popconfirm
                      key="remove"
                      title="Remove from watchlist?"
                      onConfirm={() => { removeFromWatchlist(item.id, item.type); showSuccess("Removed from watchlist"); }}
                      okText="Remove"
                      cancelText="Cancel"
                    >
                      <Button type="link" danger icon={<DeleteOutlined />} size="small">
                        Remove
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Typography.Text
                    strong
                    style={{ fontSize: 12, display: "block", marginBottom: 4 }}
                    ellipsis={{ tooltip: item.title }}
                  >
                    {item.title}
                  </Typography.Text>

                  <Space size={4} wrap>
                    {item.voteAverage != null && (
                      <Tag color="gold" style={{ margin: 0 }}>
                        <StarFilled /> {item.voteAverage.toFixed(1)}
                      </Tag>
                    )}
                    {rating && (
                      <Tag color="green" style={{ margin: 0 }}>
                        My: {rating.userRating}/10
                      </Tag>
                    )}
                  </Space>


                  {rating?.review && (
                    <Typography.Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ fontSize: 11, color: "#aaa", marginTop: 6, marginBottom: 0 }}
                    >
                      "{rating.review}"
                    </Typography.Paragraph>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {ratingTarget && (
        <RatingModal
          title={ratingTarget.title}
          existing={getRating(ratingTarget.id, ratingTarget.type)}
          onSave={(r, review) => {
            setRating(ratingTarget.id, ratingTarget.type, ratingTarget.title, r, review);
            showSuccess("Rating saved");
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}
    </motion.div>
  );
}

export default WatchlistPage;
