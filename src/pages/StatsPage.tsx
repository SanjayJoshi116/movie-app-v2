import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Row, Col, Card, Typography, Spin, Empty, Statistic } from "antd";
import {
  EyeOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  StarOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { fetchStats, type StatsData } from "../api/userApi";

const { Title } = Typography;

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const GOLD = "#f5c518";
const BLUE = "#4096ff";
const PIE_COLORS = [GOLD, BLUE];

const CHART_STYLE = { fontSize: 12 };

function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data || data.totalWatched === 0) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
        <Title level={2} style={{ marginBottom: 24 }}>Your Stats</Title>
        <Empty description="Start watching movies and TV shows to see your stats here." />
      </motion.div>
    );
  }

  const mediaTypeData = [
    { name: "Movies", value: data.moviesCount },
    { name: "TV Shows", value: data.tvCount },
  ].filter((d) => d.value > 0);

  const ratingDist = data.ratingDistribution.filter((d) => d.count > 0);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Title level={2} style={{ marginBottom: 24 }}>Your Stats</Title>

      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Watched"
              value={data.totalWatched}
              prefix={<EyeOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Movies"
              value={data.moviesCount}
              prefix={<VideoCameraOutlined style={{ color: GOLD }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="TV Shows"
              value={data.tvCount}
              prefix={<PlaySquareOutlined style={{ color: BLUE }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Avg. Your Rating"
              value={data.avgUserRating || "—"}
              suffix={data.avgUserRating ? "/ 10" : ""}
              prefix={<StarOutlined style={{ color: GOLD }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Movies vs TV pie */}
        {mediaTypeData.length > 1 && (
          <Col xs={24} md={10}>
            <Card title="Movies vs TV Shows">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={mediaTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {mediaTypeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {/* Ratings distribution */}
        {ratingDist.length > 0 && (
          <Col xs={24} md={14}>
            <Card title="Your Ratings Distribution">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.ratingDistribution} style={CHART_STYLE}>
                  <XAxis dataKey="rating" tickFormatter={(v) => `${v}★`} />
                  <YAxis allowDecimals={false} width={28} />
                  <Tooltip formatter={(v) => [v, "Ratings"]} labelFormatter={(l) => `Rating: ${l}`} />
                  <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {/* Monthly activity */}
        {data.monthlyActivity.length > 0 && (
          <Col xs={24}>
            <Card title="Watch Activity by Month">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthlyActivity} style={CHART_STYLE}>
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} width={28} />
                  <Tooltip formatter={(v) => [v, "Watched"]} />
                  <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {/* Top genres */}
        <Col xs={24}>
          <Card title="Top Genres">
            {data.topGenres.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topGenres} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="genre" width={100} />
                  <Tooltip formatter={(v) => [v, "Titles"]} />
                  <Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography.Text type="secondary" style={{ display: "block", padding: "24px 0", textAlign: "center" }}>
                Genre data not yet available. Visit the{" "}
                <a href="/recommendations">For You</a> page once to generate it.
              </Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </motion.div>
  );
}

export default StatsPage;
