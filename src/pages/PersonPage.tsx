import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Alert, Row, Col, Button, Typography, Descriptions, Spin, Tabs, Image, Empty,
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
import { getApiError } from "../utils/apiError";
import { settledData, isNotFound } from "../utils/settled";
import NotFoundPage from "./NotFoundPage";
import { useValidId } from "../hooks/useValidId";
import { safeHttpUrl } from "../utils/safeUrl";
import { LoadError } from "../components/LoadError";
import type {
  TMDBPerson,
  TMDBPersonCredits,
  TMDBPersonImages,
} from "../types";
import { mergeCredits, mergeCrew, sortCreditsNewestFirst } from "../utils/personCredits";
import { pageVariants, IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { goBack } from "../utils/goBack";
import { usePageTitle } from "../hooks/usePageTitle";

// A malformed credits body (no array) counts as no credits, not a crash.
function toCredits(c: TMDBPersonCredits): TMDBPersonCredits {
  return {
    cast: sortCreditsNewestFirst(mergeCredits(Array.isArray(c?.cast) ? c.cast : [])),
    crew: Array.isArray(c?.crew) ? c.crew : [],
  };
}

/** A credits request that failed for a reason other than "TMDB has none". */
const creditsFailed = (r: PromiseSettledResult<unknown>) => r.status === "rejected" && !isNotFound(r.reason);

function PersonPage() {
  const id = useValidId();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; scrollY?: number; loadedPages?: number } | null;
  const from = locationState?.from;
  const savedScrollY = locationState?.scrollY;
  const savedLoadedPages = locationState?.loadedPages;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCreditsTab = searchParams.get("tab");
  const { isFollowing, follow, unfollow, error: followStatusError, loading: followStatusLoading } = useFollowedPeople();
  const { showSuccess, showError } = useToast();
  const [person, setPerson] = useState<TMDBPerson | null>(null);
  usePageTitle(person?.name ?? "Person");
  const [movieCredits, setMovieCredits] = useState<TMDBPersonCredits | null>(null);
  const [tvCredits, setTvCredits] = useState<TMDBPersonCredits | null>(null);
  const [images, setImages] = useState<TMDBPersonImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not-found" | "failed" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [creditsError, setCreditsError] = useState(false);
  const [creditsRetrying, setCreditsRetrying] = useState(false);
  // Bumped per person load and per credits retry: only the latest one applies.
  const creditsRequest = useRef(0);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    // Never show the previous person while the next one loads.
    setPerson(null);
    setMovieCredits(null);
    setTvCredits(null);
    setImages(null);
    setError(null);
    setCreditsError(false);
    setCreditsRetrying(false);
    setLoading(true);
    const request = ++creditsRequest.current;
    let cancelled = false;

    const load = async () => {
      // Only the person record is essential. Credits that fail show their own
      // error with Retry; photos just hide.
      const [personRes, movieRes, tvRes, imagesRes] = await Promise.allSettled([
        fetchPerson(id),
        fetchPersonMovieCredits(id),
        fetchPersonTVCredits(id),
        fetchPersonImages(id),
      ]);
      if (cancelled || request !== creditsRequest.current) return;

      if (personRes.status === "rejected") {
        console.error("Error fetching person details:", personRes.reason);
        setError(isNotFound(personRes.reason) ? "not-found" : "failed");
      } else {
        const movies = settledData(movieRes);
        const tv = settledData(tvRes);
        setPerson(personRes.value.data);
        setMovieCredits(movies ? toCredits(movies) : null);
        setTvCredits(tv ? toCredits(tv) : null);
        setCreditsError(creditsFailed(movieRes) || creditsFailed(tvRes));
        setImages(settledData(imagesRes) ?? null);
      }
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  // Refetch only the credits, so the bio and photos stay on screen.
  const retryCredits = async () => {
    if (!id) return;
    const request = ++creditsRequest.current;
    setCreditsRetrying(true);
    const [movieRes, tvRes] = await Promise.allSettled([fetchPersonMovieCredits(id), fetchPersonTVCredits(id)]);
    if (request !== creditsRequest.current) return;
    const movies = settledData(movieRes);
    const tv = settledData(tvRes);
    if (movies) setMovieCredits(toCredits(movies));
    if (tv) setTvCredits(toCredits(tv));
    setCreditsError(creditsFailed(movieRes) || creditsFailed(tvRes));
    setCreditsRetrying(false);
  };

  if (id === null) return <NotFoundPage />;
  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <Spin size="large" />
      </div>
    );
  if (error === "not-found") return <LoadError notFound title="Person not found" />;
  if (error || !person)
    return <LoadError title="Failed to load this person" onRetry={() => setReloadKey((k) => k + 1)} />;

  // TMDB homepages are community-edited: only an http(s) URL becomes a link.
  const homepageUrl = safeHttpUrl(person.homepage);

  type TabItem = { key: string; label: string; children: ReactNode };
  const crew = mergeCrew(movieCredits?.crew ?? [], tvCredits?.crew ?? []);

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
    crew.length > 0
      ? {
          key: "crew",
          label: `Crew (${crew.length})`,
          children: <MediaCardGrid items={crew} mediaType="movie" limit={crew.length} />,
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
  // No tab in the URL: open on the person's main department, so a director's
  // page leads with what they directed rather than their cameos.
  const defaultTab = person.known_for_department !== "Acting" && crew.length > 0
    ? "crew"
    : tabItems.find((t) => t.key !== "images")?.key ?? tabItems[0]?.key;

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
          onClick={() => goBack(navigate, {
            from, state: { scrollY: savedScrollY, loadedPages: savedLoadedPages, isReturn: true }, fallback: "/people",
          })}
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
                // Without the followed list (loading or failed), "Follow" would claim
                // "not following", and a follow during the load would be undone by it.
                disabled={followStatusError || followStatusLoading}
                loading={followStatusLoading}
                aria-label={followStatusLoading ? "Loading follow status" : undefined}
                onClick={async () => {
                  try {
                    if (isFollowing(person.id)) {
                      await unfollow(person.id);
                      showSuccess(`Unfollowed ${person.name}`);
                    } else {
                      await follow(person.id, person.name, person.profile_path ?? null);
                      showSuccess(`Following ${person.name}`);
                    }
                  } catch (err) {
                    showError(getApiError(err, "Failed to update follow status."));
                  }
                }}
              >
                {followStatusLoading ? "" : isFollowing(person.id) ? "Unfollow" : "Follow"}
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
                  {homepageUrl ? (
                    <a href={homepageUrl} target="_blank" rel="noopener noreferrer">
                      {person.homepage}
                    </a>
                  ) : (
                    person.homepage
                  )}
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

        {creditsError && tabItems.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Some credits couldn't be loaded."
            action={<Button size="small" loading={creditsRetrying} onClick={retryCredits}>Retry</Button>}
          />
        )}
        {creditsRetrying && tabItems.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Spin />
          </div>
        ) : creditsError && tabItems.length === 0 ? (
          <LoadError title="Couldn't load credits" onRetry={retryCredits} />
        ) : tabItems.length > 0 ? (
          <Tabs
            activeKey={activeCreditsTab && tabItems.some((t) => t.key === activeCreditsTab) ? activeCreditsTab : defaultTab}
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
