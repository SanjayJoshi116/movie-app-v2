import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Button, Typography, Empty, Spin, Divider } from "antd";
import { StarFilled, BulbOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import {
  fetchForYouRecommendations,
  fetchPersonalizedRecommendations,
  type PersonalizedRecSection,
} from "../api/userApi";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

function getRatingColor(vote: number): string {
  if (vote >= 8) return "#52c41a";
  if (vote >= 5) return "#faad14";
  return "#ff4d4f";
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function RecCard({ item, navigate }: { item: PersonalizedRecSection["items"][number]; navigate: (path: string, opts?: object) => void }) {
  const path = `/${item.type === "movie" ? "movie" : "tv"}/${item.id}`;
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card
        hoverable
        className="glass-card"
        onClick={() => navigate(path, { state: { from: "/recommendations" } })}
        cover={
          <img
            src={item.posterPath ? `${IMG_URL}${item.posterPath}` : "https://placehold.co/500x750?text=No+Image"}
            alt={item.title}
            loading="lazy"
            className="movie-poster-img"
          />
        }
        styles={{ body: { padding: "10px 12px" } }}
        style={{ height: "100%" }}
      >
        <Card.Meta
          title={<span style={{ fontSize: 13, lineHeight: "1.3", display: "block" }}>{item.title}</span>}
          description={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <Tag color={getRatingColor(item.voteAverage)} style={{ margin: 0 }}>
                <StarFilled style={{ marginRight: 2 }} />
                {item.voteAverage.toFixed(1)}
              </Tag>
              <Button
                size="small"
                type="primary"
                ghost
                onClick={(e) => { e.stopPropagation(); navigate(path, { state: { from: "/recommendations" } }); }}
                aria-label={`Details for ${item.title}`}
              >
                Details
              </Button>
            </div>
          }
        />
      </Card>
    </motion.div>
  );
}

function SectionRow({ section, navigate }: { section: PersonalizedRecSection; navigate: (path: string, opts?: object) => void }) {
  return (
    <div key={section.key}>
      <Divider orientation="left">
        <Typography.Text strong style={{ fontSize: 15 }}>{section.label}</Typography.Text>
      </Divider>
      <Row gutter={[16, 20]} style={{ marginBottom: 8 }}>
        {section.items.map((item) => (
          <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4} xl={4}>
            <RecCard item={item} navigate={navigate} />
          </Col>
        ))}
      </Row>
    </div>
  );
}

function RecommendationsPage() {
  const navigate = useNavigate();
  const { watchedList } = useAppContext();
  const [sections, setSections] = useState<PersonalizedRecSection[]>([]);
  const [personalizedSections, setPersonalizedSections] = useState<PersonalizedRecSection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (watchedList.length === 0) return;
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchForYouRecommendations(),
      fetchPersonalizedRecommendations(),
    ]).then(([forYouRes, personalizedRes]) => {
      if (cancelled) return;
      if (forYouRes.status === "fulfilled") setSections(forYouRes.value.data);
      if (personalizedRes.status === "fulfilled") setPersonalizedSections(personalizedRes.value.data);
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [watchedList]);

  const totalItems =
    sections.reduce((acc, s) => acc + s.items.length, 0) +
    personalizedSections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Typography.Title level={2} style={{ marginBottom: 8 }}>
        For You
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Recommendations based on {watchedList.length} watched title{watchedList.length !== 1 ? "s" : ""}
      </Typography.Text>

      {watchedList.length === 0 ? (
        <Empty
          image={<BulbOutlined style={{ fontSize: 48, color: "#f5c518" }} />}
          description={
            <span>
              No watched titles yet.{" "}
              <Button type="link" onClick={() => navigate("/movies")} style={{ padding: 0 }}>
                Browse movies
              </Button>{" "}
              or{" "}
              <Button type="link" onClick={() => navigate("/tv")} style={{ padding: 0 }}>
                TV shows
              </Button>{" "}
              and mark them as watched.
            </span>
          }
          style={{ padding: "60px 0" }}
        />
      ) : loading ? (
        <Spin size="large" style={{ display: "block", margin: "80px auto" }} />
      ) : totalItems === 0 ? (
        <Empty
          image={<BulbOutlined style={{ fontSize: 48, color: "#aaa" }} />}
          description="No recommendations found for your watched titles."
          style={{ padding: "60px 0" }}
        />
      ) : (
        <>
          {personalizedSections.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {sections.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
        </>
      )}
    </motion.div>
  );
}

export default RecommendationsPage;
