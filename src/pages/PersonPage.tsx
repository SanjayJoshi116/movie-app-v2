import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Card, Button, Typography, Descriptions, Spin, Tabs, Image, Empty,
} from "antd";
import { LeftOutlined, UserAddOutlined, UserDeleteOutlined } from "@ant-design/icons";
import {
  fetchPerson,
  fetchPersonCombinedCredits,
  fetchPersonMovieCredits,
  fetchPersonTVCredits,
  fetchPersonImages,
} from "../api/tmdb";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { useToast } from "../hooks/useToast";
import type {
  TMDBPerson,
  TMDBPersonCredits,
  TMDBPersonImages,
  TMDBPersonCombinedCredit,
} from "../types";
import { pageVariants, IMG_URL } from "../constants/ui";

function CreditCard({
  credit,
  onClick,
}: {
  credit: TMDBPersonCombinedCredit;
  onClick: () => void;
}) {
  const title = "title" in credit ? credit.title : credit.name;
  return (
    <Card
      hoverable
      size="small"
      onClick={onClick}
      cover={
        <img
          src={
            credit.poster_path
              ? `${IMG_URL}${credit.poster_path}`
              : "https://placehold.co/200x300?text=?"
          }
          alt={title}
          loading="lazy"
          className="rec-card-img"
        />
      }
      styles={{ body: { padding: "6px 8px" } }}
      aria-label={`View details for ${title}`}
    >
      <Typography.Text strong style={{ fontSize: 11, display: "block" }}>{title}</Typography.Text>
      {"character" in credit && credit.character && (
        <Typography.Text type="secondary" style={{ fontSize: 10 }}>{credit.character}</Typography.Text>
      )}
    </Card>
  );
}

function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; scrollY?: number; loadedPages?: number } | null;
  const from = locationState?.from;
  const savedScrollY = locationState?.scrollY;
  const savedLoadedPages = locationState?.loadedPages;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCreditsTab = searchParams.get("tab") ?? "all";
  const { isFollowing, follow, unfollow } = useFollowedPeople();
  const { showSuccess } = useToast();
  const [person, setPerson] = useState<TMDBPerson | null>(null);
  const [combinedCredits, setCombinedCredits] = useState<TMDBPersonCredits | null>(null);
  const [movieCredits, setMovieCredits] = useState<TMDBPersonCredits | null>(null);
  const [tvCredits, setTvCredits] = useState<TMDBPersonCredits | null>(null);
  const [images, setImages] = useState<TMDBPersonImages | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setLoading(true);

    const load = async () => {
      try {
        const [personRes, combinedRes, movieRes, tvRes, imagesRes] = await Promise.all([
          fetchPerson(id),
          fetchPersonCombinedCredits(id),
          fetchPersonMovieCredits(id),
          fetchPersonTVCredits(id),
          fetchPersonImages(id),
        ]);

        setPerson(personRes.data);
        setCombinedCredits(combinedRes.data);
        setMovieCredits(movieRes.data);
        setTvCredits(tvRes.data);
        setImages(imagesRes.data);
      } catch (err) {
        console.error("Error fetching person details:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <Spin size="large" />
      </div>
    );
  if (!person) return null;

  type TabItem = { key: string; label: string; children: React.ReactNode };

  const rawTabItems = ([
    combinedCredits && combinedCredits.cast.length > 0
      ? {
          key: "all",
          label: `All Credits (${combinedCredits.cast.length})`,
          children: (
            <Row gutter={[12, 16]}>
              {combinedCredits.cast.map((credit) => (
                <Col key={`cast-${credit.id}-${credit.media_type}`} xs={8} sm={6} md={4} lg={3}>
                  <CreditCard
                    credit={credit}
                    onClick={() =>
                      navigate(credit.media_type === "movie" ? `/movie/${credit.id}` : `/tv/${credit.id}`)
                    }
                  />
                </Col>
              ))}
            </Row>
          ),
        }
      : null,
    movieCredits && movieCredits.cast.length > 0
      ? {
          key: "movies",
          label: `Movies (${movieCredits.cast.length})`,
          children: (
            <Row gutter={[12, 16]}>
              {movieCredits.cast.map((credit) => (
                <Col key={`movie-${credit.id}`} xs={8} sm={6} md={4} lg={3}>
                  <CreditCard
                    credit={credit}
                    onClick={() => navigate(`/movie/${credit.id}`)}
                  />
                </Col>
              ))}
            </Row>
          ),
        }
      : null,
    tvCredits && tvCredits.cast.length > 0
      ? {
          key: "tv",
          label: `TV Shows (${tvCredits.cast.length})`,
          children: (
            <Row gutter={[12, 16]}>
              {tvCredits.cast.map((credit) => (
                <Col key={`tv-${credit.id}`} xs={8} sm={6} md={4} lg={3}>
                  <CreditCard
                    credit={credit}
                    onClick={() => navigate(`/tv/${credit.id}`)}
                  />
                </Col>
              ))}
            </Row>
          ),
        }
      : null,
    images && images.profiles.length > 0
      ? {
          key: "images",
          label: `Photos (${images.profiles.length})`,
          children: (
            <Row gutter={[12, 12]}>
              {images.profiles.map((image) => (
                <Col key={image.file_path} xs={8} sm={6} md={4} lg={3}>
                  <Image
                    src={`${IMG_URL}${image.file_path}`}
                    alt="Profile"
                    style={{ borderRadius: 8, width: "100%" }}
                  />
                </Col>
              ))}
            </Row>
          ),
        }
      : null,
  ] as Array<TabItem | null | false>);
  const tabItems = rawTabItems.filter((x): x is TabItem => Boolean(x));

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => from ? navigate(from, { state: { scrollY: savedScrollY, loadedPages: savedLoadedPages, isReturn: true } }) : navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>

        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          <Col xs={24} sm={8} md={6}>
            <img
              src={
                person.profile_path
                  ? `${IMG_URL}${person.profile_path}`
                  : "https://placehold.co/300x450?text=No+Image"
              }
              alt={person.name}
              className="person-profile-img"
              style={{ width: "100%", borderRadius: 12 }}
            />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {person.name}
              </Typography.Title>
              <Button
                icon={isFollowing(person.id) ? <UserDeleteOutlined /> : <UserAddOutlined />}
                type={isFollowing(person.id) ? "default" : "primary"}
                onClick={async () => {
                  if (isFollowing(person.id)) {
                    await unfollow(person.id);
                    showSuccess(`Unfollowed ${person.name}`);
                  } else {
                    await follow(person.id, person.name, person.profile_path ?? null);
                    showSuccess(`Following ${person.name}`);
                  }
                }}
              >
                {isFollowing(person.id) ? "Unfollow" : "Follow"}
              </Button>
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered style={{ marginBottom: 16 }}>
              {person.birthday && (
                <Descriptions.Item label="Birthday">{person.birthday}</Descriptions.Item>
              )}
              {person.place_of_birth && (
                <Descriptions.Item label="Place of Birth">{person.place_of_birth}</Descriptions.Item>
              )}
            </Descriptions>

            {person.biography && (
              <Typography.Paragraph
                ellipsis={{ rows: 6, expandable: true, symbol: "Read more" }}
                style={{ fontSize: 14, lineHeight: 1.7 }}
              >
                {person.biography}
              </Typography.Paragraph>
            )}
          </Col>
        </Row>

        {tabItems.length > 0 ? (
          <Tabs
            activeKey={tabItems.some(t => t.key === activeCreditsTab) ? activeCreditsTab : tabItems[0]?.key}
            onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
            items={tabItems}
          />
        ) : (
          <Empty description="No credits available" />
        )}
      </div>
    </motion.div>
  );
}

export default PersonPage;
