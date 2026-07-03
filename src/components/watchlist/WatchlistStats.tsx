import { Card, Row, Col, Statistic, Divider, Progress, Typography } from "antd";
import { StarFilled } from "@ant-design/icons";
import type { WatchlistEntry, RatingsMap } from "../../types";

interface Props {
  watchlist: WatchlistEntry[];
  allRatings: RatingsMap;
}

const WatchlistStats = ({ watchlist, allRatings }: Props) => {
  const totalItems = watchlist.length;
  const watchedCount = watchlist.filter((w) => w.watched).length;
  const watchedPercent = totalItems > 0 ? Math.round((watchedCount / totalItems) * 100) : 0;

  const ratingValues = Object.values(allRatings).map((r) => r.userRating);
  const avgRating =
    ratingValues.length > 0
      ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
      : "—";

  const movieCount = watchlist.filter((w) => w.type === "movie").length;
  const tvCount = watchlist.filter((w) => w.type === "tv").length;

  return (
    <Card className="glass-card" style={{ marginBottom: 28 }}>
      <Typography.Title level={4} style={{ marginBottom: 20 }}>
        My Stats
      </Typography.Title>

      <Row gutter={[24, 16]}>
        <Col xs={12} sm={6}>
          <Statistic title="Total" value={totalItems} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="Watched" value={watchedCount} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="Avg Rating"
            value={avgRating}
            prefix={ratingValues.length > 0 ? <StarFilled style={{ color: "#f5c518" }} /> : undefined}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="Rated" value={ratingValues.length} />
        </Col>
      </Row>

      <Divider style={{ margin: "16px 0" }} />

      <Row gutter={[16, 8]} align="middle">
        <Col xs={24} sm={12}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Watched progress
          </Typography.Text>
          <Progress
            percent={watchedPercent}
            strokeColor="#f5c518"
            style={{ marginTop: 4 }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="Movies" value={movieCount} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="TV Shows" value={tvCount} />
        </Col>
      </Row>
    </Card>
  );
};

export default WatchlistStats;
