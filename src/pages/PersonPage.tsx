import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Typography, Descriptions, Spin, Tabs, Image, Empty,
} from "antd";
import { LeftOutlined, UserAddOutlined, UserDeleteOutlined } from "@ant-design/icons";
import {
  fetchPerson,
  fetchPersonMovieCredits,
  fetchPersonTVCredits,
  fetchPersonImages,
} from "../api/tmdb";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { useToast } from "../hooks/useToast";
import { MediaCardGrid } from "../components/MediaCardGrid";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { formatDateDMY } from "../utils/formatDate";
import type {
  TMDBPerson,
  TMDBPersonCredits,
  TMDBPersonImages,
} from "../types";
import { pageVariants, IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";

function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; scrollY?: number; loadedPages?: number } | null;
  const from = locationState?.from;
  const savedScrollY = locationState?.scrollY;
  const savedLoadedPages = locationState?.loadedPages;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCreditsTab = searchParams.get("tab") ?? "movies";
  const { isFollowing, follow, unfollow } = useFollowedPeople();
  const { showSuccess } = useToast();
  const [person, setPerson] = useState<TMDBPerson | null>(null);
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
        const [personRes, movieRes, tvRes, imagesRes] = await Promise.all([
          fetchPerson(id),
          fetchPersonMovieCredits(id),
          fetchPersonTVCredits(id),
          fetchPersonImages(id),
        ]);

        setPerson(personRes.data);
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

  type TabItem = { key: string; label: string; children: ReactNode };

  const rawTabItems = ([
    movieCredits && movieCredits.cast.length > 0
      ? {
          key: "movies",
          label: `Movies (${movieCredits.cast.length})`,
          children: (
            <MediaCardGrid
              items={movieCredits.cast.map((c) => ({
                id: c.id,
                posterPath: c.poster_path,
                name: "title" in c ? c.title : c.name,
                subtitle: c.character,
              }))}
              mediaType="movie"
              limit={movieCredits.cast.length}
            />
          ),
        }
      : null,
    tvCredits && tvCredits.cast.length > 0
      ? {
          key: "tv",
          label: `TV Shows (${tvCredits.cast.length})`,
          children: (
            <MediaCardGrid
              items={tvCredits.cast.map((c) => ({
                id: c.id,
                posterPath: c.poster_path,
                name: "name" in c ? c.name : c.title,
                subtitle: c.character,
              }))}
              mediaType="tv"
              limit={tvCredits.cast.length}
            />
          ),
        }
      : null,
    images && images.profiles.length > 0
      ? {
          key: "images",
          label: `Photos (${images.profiles.length})`,
          children: (
            <Image.PreviewGroup>
              <Row gutter={[12, 12]}>
                {images.profiles.map((image) => (
                  <Col key={image.file_path} xs={12} sm={8} md={6}>
                    <Image
                      src={`${IMG_URL}${image.file_path}`}
                      alt="Profile"
                      className="backdrop-img"
                      style={{ borderRadius: 8 }}
                    />
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>
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
      <div className="detail-container" style={{ paddingBottom: 16 }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => from ? navigate(from, { state: { scrollY: savedScrollY, loadedPages: savedLoadedPages, isReturn: true } }) : navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>

        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          <Col xs={24} sm={8} md={6}>
            {person.profile_path ? (
              <img
                src={`${IMG_URL}${person.profile_path}`}
                alt={person.name}
                className="person-profile-img"
                style={{ width: "100%", borderRadius: 12 }}
              />
            ) : (
              <PosterPlaceholder className="person-profile-img" style={{ width: "100%", borderRadius: 12, aspectRatio: "2 / 3" }} />
            )}
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
              {person.known_for_department && (
                <Descriptions.Item label="Known For">{person.known_for_department}</Descriptions.Item>
              )}
              {person.birthday && (
                <Descriptions.Item label="Birthday">{formatDateDMY(person.birthday)}</Descriptions.Item>
              )}
              {person.place_of_birth && (
                <Descriptions.Item label="Place of Birth">{person.place_of_birth}</Descriptions.Item>
              )}
              {person.deathday && (
                <Descriptions.Item label="Died">{formatDateDMY(person.deathday)}</Descriptions.Item>
              )}
              {person.imdb_id && (
                <Descriptions.Item label="IMDb">
                  <a href={`https://www.imdb.com/name/${person.imdb_id}`} target="_blank" rel="noopener noreferrer">
                    View on IMDb
                  </a>
                </Descriptions.Item>
              )}
              {person.homepage && (
                <Descriptions.Item label="Website">
                  <a href={person.homepage} target="_blank" rel="noopener noreferrer">
                    {person.homepage}
                  </a>
                </Descriptions.Item>
              )}
            </Descriptions>

            {person.biography && (
              <Typography.Paragraph
                ellipsis={{ rows: 6, expandable: true, symbol: "Read more" }}
                style={{ fontSize: FONT_SIZE.body, lineHeight: 1.7 }}
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
