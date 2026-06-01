import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Tag, Button, Typography, Empty, Spin, Divider } from "antd";
import { StarFilled, BulbOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import {
  fetchForYouRecommendations,
  fetchPersonalizedRecommendations,
  fetchFollowedPeopleRecommendations,
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

const REC_CACHE_KEY = "cinedb_recommendations";
const REC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface RecCache {
  sections: PersonalizedRecSection[];
  personalizedSections: PersonalizedRecSection[];
  followedSections: PersonalizedRecSection[];
  scrollY: number;
  ts: number;
}

function readRecCache(): RecCache | null {
  try {
    const raw = sessionStorage.getItem(REC_CACHE_KEY);
    if (!raw) return null;
    const parsed: RecCache = JSON.parse(raw);
    if (Date.now() - parsed.ts > REC_CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
}

function RecommendationsPage() {
  const navigate = useNavigate();
  const { watchedList, isDataLoading } = useAppContext();

  const [cache] = useState<RecCache | null>(readRecCache);

  const [sections, setSections] = useState<PersonalizedRecSection[]>(cache?.sections ?? []);
  const [personalizedSections, setPersonalizedSections] = useState<PersonalizedRecSection[]>(cache?.personalizedSections ?? []);
  const [followedSections, setFollowedSections] = useState<PersonalizedRecSection[]>(cache?.followedSections ?? []);
  const [loading, setLoading] = useState(!cache);
  const hasFetched = useRef(Boolean(cache));

  // Restore scroll once on mount if cache hit — rAF fires after browser's own scroll restoration
  useEffect(() => {
    if (!cache?.scrollY) return;
    const id = requestAnimationFrame(() => window.scrollTo(0, cache.scrollY));
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref to latest data so unmount cleanup captures current values
  const latestData = useRef({ sections, personalizedSections, followedSections });
  useEffect(() => { latestData.current = { sections, personalizedSections, followedSections }; });

  // Save to sessionStorage on unmount
  useEffect(() => {
    return () => {
      const { sections: s, personalizedSections: ps, followedSections: fs } = latestData.current;
      sessionStorage.setItem(REC_CACHE_KEY, JSON.stringify({
        sections: s, personalizedSections: ps, followedSections: fs,
        scrollY: window.scrollY,
        ts: Date.now(),
      }));
    };
  }, []);

  useEffect(() => {
    if (isDataLoading || watchedList.length === 0 || hasFetched.current) return;
    hasFetched.current = true;
    let cancelled = false;
    let pending = 3;
    const done = () => { if (--pending === 0 && !cancelled) setLoading(false); };

    fetchForYouRecommendations()
      .then(res => { if (!cancelled) setSections(res.data); })
      .catch(() => {})
      .finally(done);

    fetchPersonalizedRecommendations()
      .then(res => { if (!cancelled) setPersonalizedSections(res.data); })
      .catch(() => {})
      .finally(done);

    fetchFollowedPeopleRecommendations()
      .then(res => { if (!cancelled) setFollowedSections(res.data); })
      .catch(() => {})
      .finally(done);

    return () => {
      cancelled = true;
      hasFetched.current = false; // allow retry on StrictMode re-mount
    };
  }, [isDataLoading, watchedList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalItems =
    sections.reduce((acc, s) => acc + s.items.length, 0) +
    personalizedSections.reduce((acc, s) => acc + s.items.length, 0) +
    followedSections.reduce((acc, s) => acc + s.items.length, 0);

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

      {isDataLoading ? (
        <Spin size="large" style={{ display: "block", margin: "80px auto" }} />
      ) : watchedList.length === 0 ? (
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
      ) : (
        <>
          {loading && totalItems === 0 && (
            <Spin size="large" style={{ display: "block", margin: "80px auto" }} />
          )}
          {followedSections.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {personalizedSections.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {sections.map((section) => (
            <SectionRow key={section.key} section={section} navigate={navigate} />
          ))}
          {!loading && totalItems === 0 && (
            <Empty
              image={<BulbOutlined style={{ fontSize: 48, color: "#aaa" }} />}
              description="No recommendations found for your watched titles."
              style={{ padding: "60px 0" }}
            />
          )}
        </>
      )}
    </motion.div>
  );
}

export default RecommendationsPage;
