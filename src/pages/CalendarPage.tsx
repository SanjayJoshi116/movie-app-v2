import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Typography, Radio, Divider, Row, Col, Card, Tag, Empty, Button } from "antd";
import { CalendarOutlined, StarFilled, DownloadOutlined } from "@ant-design/icons";
import { discoverMovies, discoverTV } from "../api/tmdb";
import SkeletonCard from "../components/SkeletonCard";
import type { TMDBMovieSummary, TMDBTVSummary } from "../types";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

type MediaFilter = "both" | "movies" | "tv";

interface CalendarItem {
  id: number;
  type: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
}

interface DateGroup {
  date: string;
  label: string;
  items: CalendarItem[];
}

function formatDateLabel(dateStr: string): string {
  // Add time to avoid timezone offset issues
  const date = new Date(dateStr + "T12:00:00");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function groupByDate(items: CalendarItem[]): DateGroup[] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (!map.has(item.releaseDate)) map.set(item.releaseDate, []);
    map.get(item.releaseDate)!.push(item);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateItems]) => ({
      date,
      label: formatDateLabel(date),
      items: dateItems,
    }));
}

function exportIcal(groups: DateGroup[]) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CINE DB//Release Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const group of groups) {
    const d = group.date.replace(/-/g, "");
    const nextDay = new Date(group.date + "T12:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const dEnd = nextDay.toISOString().slice(0, 10).replace(/-/g, "");
    for (const item of group.items) {
      const kind = item.type === "movie" ? "Movie" : "TV Show";
      lines.push(
        "BEGIN:VEVENT",
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${dEnd}`,
        `SUMMARY:${item.title} (${kind})`,
        `UID:cinedb-${item.type}-${item.id}@cinedb`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cinedb-releases.ics";
  a.click();
  URL.revokeObjectURL(url);
}

function getRatingColor(vote: number): string {
  if (vote >= 8) return "#52c41a";
  if (vote >= 5) return "#faad14";
  return "#ff4d4f";
}

function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { scrollY?: number; mediaFilter?: MediaFilter; isReturn?: boolean } | null;
  const isReturning = locationState?.isReturn ?? false;
  const savedScrollY = locationState?.scrollY ?? 0;
  const savedMediaFilter = locationState?.mediaFilter;

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>(
    (isReturning && savedMediaFilter) ? savedMediaFilter : "both"
  );
  const [groups, setGroups] = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const didRestoreRef = useRef(false);

  const fetchCalendar = useCallback(async (filter: MediaFilter) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const movieParams = {
        "primary_release_date.gte": today,
        "primary_release_date.lte": future,
        sort_by: "primary_release_date.asc",
        page: 1,
      } as Record<string, string | number>;
      const tvParams = {
        "first_air_date.gte": today,
        "first_air_date.lte": future,
        sort_by: "first_air_date.asc",
        page: 1,
      } as Record<string, string | number>;

      const allItems: CalendarItem[] = [];

      const fetchAllPages = async <T,>(
        fetcher: (params: Record<string, string | number>) => Promise<{ data: { results: T[]; total_pages: number } }>,
        baseParams: Record<string, string | number>,
      ): Promise<T[]> => {
        const first = await fetcher(baseParams);
        const pages = Math.min(first.data.total_pages, 3);
        const results: T[] = [...first.data.results];
        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, i) =>
              fetcher({ ...baseParams, page: i + 2 }).then((r) => r.data.results),
            ),
          );
          rest.forEach((r) => results.push(...r));
        }
        return results;
      };

      if (filter === "movies" || filter === "both") {
        const movies = await fetchAllPages<TMDBMovieSummary>(discoverMovies, movieParams);
        for (const m of movies) {
          if (m.release_date) {
            allItems.push({
              id: m.id,
              type: "movie",
              title: m.title,
              posterPath: m.poster_path,
              releaseDate: m.release_date,
              voteAverage: m.vote_average,
            });
          }
        }
      }

      if (filter === "tv" || filter === "both") {
        const shows = await fetchAllPages<TMDBTVSummary>(discoverTV, tvParams);
        for (const t of shows) {
          const date = (t as any).first_air_date;
          if (date) {
            allItems.push({
              id: t.id,
              type: "tv",
              title: t.name,
              posterPath: t.poster_path,
              releaseDate: date,
              voteAverage: t.vote_average,
            });
          }
        }
      }

      setGroups(groupByDate(allItems));
    } catch (err) {
      console.error("Error fetching calendar:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar(mediaFilter);
  }, [mediaFilter, fetchCalendar]);

  useLayoutEffect(() => {
    if (isReturning && savedScrollY > 0 && !didRestoreRef.current && groups.length > 0) {
      didRestoreRef.current = true;
      window.scrollTo(0, savedScrollY);
    }
  }, [groups, isReturning, savedScrollY]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <CalendarOutlined style={{ fontSize: 24, color: "#f5c518" }} />
        <Typography.Title level={2} style={{ margin: 0, flex: 1 }}>
          Release Calendar
        </Typography.Title>
        {groups.length > 0 && (
          <Button icon={<DownloadOutlined />} size="small" onClick={() => exportIcal(groups)}>
            Export iCal
          </Button>
        )}
      </div>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
        Upcoming releases in the next 7 days
      </Typography.Text>

      <Radio.Group
        value={mediaFilter}
        onChange={(e) => setMediaFilter(e.target.value)}
        style={{ marginBottom: 24 }}
        buttonStyle="solid"
      >
        <Radio.Button value="both">All</Radio.Button>
        <Radio.Button value="movies">Movies</Radio.Button>
        <Radio.Button value="tv">TV Shows</Radio.Button>
      </Radio.Group>

      {loading ? (
        <SkeletonCard count={12} />
      ) : groups.length === 0 ? (
        <Empty
          image={<CalendarOutlined style={{ fontSize: 48, color: "#aaa" }} />}
          description="No upcoming releases in the next 7 days."
          style={{ padding: "60px 0" }}
        />
      ) : (
        groups.map((group) => (
          <div key={group.date}>
            <Divider orientation="left">
              <Typography.Text strong style={{ fontSize: 14 }}>{group.label}</Typography.Text>
            </Divider>
            <Row gutter={[12, 16]} style={{ marginBottom: 8 }}>
              {group.items.map((item) => (
                <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4} xl={4}>
                  <motion.div
                    whileHover={{ scale: 1.04, y: -4 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: "/calendar", scrollY: window.scrollY, mediaFilter, isReturn: false } })}
                  >
                    <Card
                      hoverable
                      className="glass-card"
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
                      <Typography.Text
                        strong
                        style={{ fontSize: 12, display: "block", marginBottom: 4 }}
                        ellipsis={{ tooltip: item.title }}
                      >
                        {item.title}
                      </Typography.Text>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0, fontSize: 10 }}>
                          {item.type === "movie" ? "Movie" : "TV"}
                        </Tag>
                        {item.voteAverage > 0 && (
                          <Tag color={getRatingColor(item.voteAverage)} style={{ margin: 0, fontSize: 10 }}>
                            <StarFilled style={{ marginRight: 2 }} />
                            {item.voteAverage.toFixed(1)}
                          </Tag>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </div>
        ))
      )}
    </motion.div>
  );
}

export default CalendarPage;
