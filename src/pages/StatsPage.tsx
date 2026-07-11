import { useEffect, useState, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Typography, Spin, Empty, Tabs } from "antd";
import {
  EyeOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  StarOutlined,
  StarFilled,
  FormOutlined,
  ClockCircleOutlined,
  EditOutlined,
  UnorderedListOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { InfoTooltip } from "../components/InfoTooltip";
import { FONT_SIZE } from "../constants/typography";
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
  AreaChart,
  Area,
} from "recharts";
import { fetchStats, type StatsData } from "../api/userApi";
import { pageVariants, RATING_GOLD, WATCHED_GREEN, IMG_URL } from "../constants/ui";
import { PosterPlaceholder } from "../components/PosterPlaceholder";

const { Title, Text } = Typography;

const GOLD = RATING_GOLD;
const BLUE = "#4096ff";
const GREEN = WATCHED_GREEN;
const PURPLE = "#722ed1";
const TEAL = "#13c2c2";
const ORANGE = "#fa8c16";
const RED = "#ff4d4f";

const PIE_COLORS = [GOLD, BLUE];
const PALETTE = [GOLD, BLUE, PURPLE, TEAL, ORANGE, GREEN, RED, "#eb2f96", "#a0d911", "#1890ff"];

const CHART_STYLE = { fontSize: FONT_SIZE.caption };

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", ko: "Korean", ja: "Japanese", fr: "French", es: "Spanish",
  de: "German", it: "Italian", zh: "Chinese", hi: "Hindi", pt: "Portuguese",
  ru: "Russian", ar: "Arabic", tr: "Turkish", th: "Thai", sv: "Swedish",
  da: "Danish", nl: "Dutch", fi: "Finnish", pl: "Polish", no: "Norwegian",
  id: "Indonesian", ta: "Tamil", te: "Telugu", ml: "Malayalam", bn: "Bengali",
  vi: "Vietnamese", cs: "Czech", ro: "Romanian", hu: "Hungarian",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function useCountUp(target: number, duration = 1200): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(eased * target));
      if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { setVal(target); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

const ratingColor = (r: string) => {
  const n = Number(r);
  if (n >= 8) return GREEN;
  if (n >= 5) return GOLD;
  return RED;
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10, 10, 20, 0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: FONT_SIZE.caption,
    }}>
      {label && <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#fff", fontWeight: 500 }}>
          {p.value} {p.name === "count" ? "items" : p.name}
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, suffix, icon, color, animate = true, tooltip }: {
  title: string;
  value: number | string;
  suffix?: string;
  icon: ReactNode;
  color: string;
  animate?: boolean;
  tooltip?: string;
}) {
  const numVal = typeof value === "number" ? value : 0;
  const animated = useCountUp(animate ? numVal : 0);
  const display = typeof value === "string" ? value : animate ? animated : value;

  return (
    <Card
      className="glass-card"
      style={{ borderTop: `3px solid ${color}`, height: "100%" }}
      styles={{ body: { padding: "16px 20px", position: "relative", overflow: "hidden" } }}
    >
      <div style={{ fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {title}
        {tooltip && <InfoTooltip title={tooltip} />}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: FONT_SIZE.display, fontWeight: 700, color }}>{display}</span>
        {suffix && <span style={{ fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.35)" }}>{suffix}</span>}
      </div>
      <div style={{ position: "absolute", bottom: 10, right: 14, opacity: 0.1, fontSize: 42, color, lineHeight: 1 }}>
        {icon}
      </div>
    </Card>
  );
}

interface DayCell { date: string; count: number; future: boolean; }

function buildHeatmapWeeks(dailyActivity: { date: string; count: number }[]): DayCell[][] {
  const activityMap = new Map(dailyActivity.map(d => [d.date, d.count]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - 363);
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const weeks: DayCell[][] = [];
  const cur = new Date(start);

  for (let w = 0; w < 53; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const y = cur.getFullYear();
      const mo = String(cur.getMonth() + 1).padStart(2, "0");
      const dy = String(cur.getDate()).padStart(2, "0");
      const dateStr = `${y}-${mo}-${dy}`;
      week.push({ date: dateStr, count: activityMap.get(dateStr) ?? 0, future: cur > today });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function heatColor(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.06)";
  if (count === 1) return "#1a5c2a";
  if (count <= 3) return "#226e35";
  if (count <= 5) return "#2ea44f";
  return "#39d353";
}

function ActivityHeatmap({ dailyActivity }: { dailyActivity: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);
  const weeks = buildHeatmapWeeks(dailyActivity);
  const CELL = 12;
  const GAP = 2;

  const monthLabels = weeks.map((week, i) => {
    const d = new Date((week[0]?.date ?? "") + "T00:00:00");
    if (i === 0) return MONTH_NAMES[d.getMonth()];
    const prev = new Date((weeks[i - 1]?.[0]?.date ?? "") + "T00:00:00");
    return d.getMonth() !== prev.getMonth() ? MONTH_NAMES[d.getMonth()] : null;
  });

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "inline-block", minWidth: weeks.length * (CELL + GAP) }}>
        <div style={{ display: "flex", marginBottom: 4 }}>
          {monthLabels.map((label, i) => (
            <div key={i} style={{ width: CELL + GAP, fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
              {label ?? ""}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 2,
                    backgroundColor: day.future ? "transparent" : heatColor(day.count),
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    if (!day.future) {
                      setHover({
                        text: `${day.date} — ${day.count} item${day.count !== 1 ? "s" : ""}`,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    if (!day.future) {
                      setHover((h) => h && { ...h, x: e.clientX, y: e.clientY });
                    }
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
          <span style={{ fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.4)" }}>Less</span>
          {[0, 1, 2, 4, 6].map((v) => (
            <div key={v} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: heatColor(v) }} />
          ))}
          <span style={{ fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.4)" }}>More</span>
        </div>
      </div>
      {hover && createPortal(
        <div style={{
          position: "fixed",
          left: hover.x + 14,
          top: hover.y - 30,
          background: "rgba(10,10,20,0.95)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: FONT_SIZE.caption,
          color: "#fff",
          pointerEvents: "none",
          zIndex: 9999,
          whiteSpace: "nowrap",
        }}>
          {hover.text}
        </div>,
        document.body
      )}
    </div>
  );
}

function PosterCard({ title, posterPath, badge, mediaType }: {
  title: string;
  posterPath: string | null;
  badge: string;
  mediaType: string;
}) {
  return (
    <div style={{ width: 110, flexShrink: 0 }}>
      <div style={{ position: "relative", borderRadius: 6, overflow: "hidden" }}>
        {posterPath ? (
          <img
            src={`${IMG_URL}${posterPath}`}
            alt={title}
            loading="lazy"
            style={{ width: "100%", display: "block" }}
          />
        ) : (
          <PosterPlaceholder style={{ width: "100%", aspectRatio: "2 / 3" }} />
        )}
        <div style={{
          position: "absolute", top: 6, right: 6,
          background: mediaType === "movie" ? GOLD : BLUE,
          color: "#000", fontSize: FONT_SIZE.caption, fontWeight: 700,
          borderRadius: 3, padding: "1px 4px",
        }}>
          {mediaType === "movie" ? "FILM" : "TV"}
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.caption, marginTop: 6, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", maxHeight: "2.6em" }}>
        {title}
      </div>
      <div style={{ fontSize: FONT_SIZE.caption, color: GOLD, fontWeight: 600, marginTop: 2 }}>{badge}</div>
    </div>
  );
}

function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatsTab = searchParams.get("tab") ?? "top-rated";

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

  const languageData = (data.languageBreakdown ?? []).map(l => ({
    ...l,
    name: LANGUAGE_NAMES[l.language] ?? l.language.toUpperCase(),
  }));

  const hasTopItems = (data.topRatedItems ?? []).length > 0 || (data.recentItems ?? []).length > 0;

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
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={8} md={4}>
          <StatCard title="Total Watched" value={data.totalWatched} icon={<EyeOutlined />} color={GREEN} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard title="Movies" value={data.moviesCount} icon={<VideoCameraOutlined />} color={GOLD} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard title="TV Shows" value={data.tvCount} icon={<PlaySquareOutlined />} color={BLUE} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            title="Avg. Your Rating"
            value={data.avgUserRating || "—"}
            suffix={data.avgUserRating ? "/ 10" : ""}
            icon={<StarOutlined />}
            color={GOLD}
            animate={false}
            tooltip="Average of your personal ratings, across titles you've rated."
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard title="Total Ratings" value={data.totalRatings} icon={<FormOutlined />} color={PURPLE} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            title="Avg. TMDB Rating"
            value={data.avgTmdbRating ?? "—"}
            suffix={data.avgTmdbRating ? "/ 10" : ""}
            icon={<StarFilled />}
            color={TEAL}
            animate={false}
            tooltip="Average TMDB community score for titles you've watched (not your own rating)."
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            title="Hours Watched"
            value={Math.round(data.totalRuntimeMinutes / 60)}
            suffix="hrs"
            icon={<ClockCircleOutlined />}
            color={ORANGE}
            tooltip="Based on runtime entered when marking titles watched. Older entries without runtime aren't counted."
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard title="Reviews Written" value={data.reviewsWritten} icon={<EditOutlined />} color={PURPLE} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            title="My Lists"
            value={data.listsCount}
            suffix={`${data.listsItemsCount} items`}
            icon={<UnorderedListOutlined />}
            color={GOLD}
            animate={false}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <StatCard
            title="Watchlist Backlog"
            value={data.watchlistUnwatched}
            suffix={`of ${data.watchlistTotal}`}
            icon={<BookOutlined />}
            color={BLUE}
            animate={false}
          />
        </Col>
      </Row>

      {/* Library Overview */}
      <Title level={4} style={{ marginBottom: 16 }}>Library Overview</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {mediaTypeData.length > 1 && (
          <Col xs={24} md={10}>
            <Card className="glass-card" title="Movies vs TV Shows">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={mediaTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {mediaTypeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {ratingDist.length > 0 && (
          <Col xs={24} md={mediaTypeData.length > 1 ? 14 : 24}>
            <Card className="glass-card" title={<>Your Ratings Distribution<InfoTooltip title="Your ratings grouped by nearest whole star." /></>}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.ratingDistribution} style={CHART_STYLE}>
                  <XAxis dataKey="rating" tickFormatter={(v) => `${v}★`} />
                  <YAxis allowDecimals={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.ratingDistribution.map((entry, i) => (
                      <Cell key={i} fill={ratingColor(entry.rating)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}
      </Row>

      {/* Watch History */}
      <Title level={4} style={{ marginBottom: 16 }}>Watch History</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} md={12}>
          <Card className="glass-card" title={<>Activity Heatmap (Last 52 Weeks)<InfoTooltip title="Counts days you watched, rated, or added a title to a list." /></>} style={{ height: "100%" }}>
            <ActivityHeatmap dailyActivity={data.dailyActivity ?? []} />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="glass-card" title="Watch Activity by Month" style={{ height: "100%" }}>
            {data.monthlyActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.monthlyActivity} style={CHART_STYLE}>
                  <defs>
                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BLUE} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2}
                    fill="url(#activityGradient)" dot={{ fill: BLUE, r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No monthly activity yet." style={{ padding: "24px 0" }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* Genres & Origins */}
      <Title level={4} style={{ marginBottom: 16 }}>Genres & Origins</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} md={12}>
          <Card className="glass-card" title="Top Genres" style={{ height: "100%" }}>
            {data.topGenres.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.topGenres} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="genre" width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.topGenres.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Text type="secondary" style={{ display: "block", padding: "24px 0", textAlign: "center" }}>
                Genre data not yet available. Visit the{" "}
                <Link to="/recommendations">For You</Link> page once to generate it.
              </Text>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="glass-card" title={<>Rating by Genre<InfoTooltip title="Average of your ratings per genre. Only genres with 3+ rated titles are shown." /></>} style={{ height: "100%" }}>
            {(data.ratingByGenre ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.ratingByGenre} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" domain={[0, 10]} allowDecimals={false} />
                  <YAxis type="category" dataKey="genre" width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgRating" radius={[0, 4, 4, 0]}>
                    {(data.ratingByGenre ?? []).map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Rate 3+ titles in the same genre to see this chart." style={{ padding: "24px 0" }} />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="glass-card" title="Language Breakdown">
            {languageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={languageData} layout="vertical" style={CHART_STYLE}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {languageData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No language data yet." style={{ padding: "24px 0" }} />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="glass-card" title={<>By Decade<InfoTooltip title="Titles grouped by the decade of their release date." /></>}>
            {(data.decadeBreakdown ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.decadeBreakdown} style={CHART_STYLE}>
                  <XAxis dataKey="decade" />
                  <YAxis allowDecimals={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data.decadeBreakdown ?? []).map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No decade data yet." style={{ padding: "24px 0" }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* Platform Breakdown & Top Items */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} md={12}>
          <Card className="glass-card" title={<>Platform Breakdown<InfoTooltip title="Where you watched, based on what you selected when marking titles watched." /></>} style={{ height: "100%" }}>
            {(data.platformBreakdown ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.platformBreakdown} style={CHART_STYLE}>
                  <XAxis dataKey="platform" />
                  <YAxis allowDecimals={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data.platformBreakdown ?? []).map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No platform data yet. Pick a platform when marking titles watched to see this chart." style={{ padding: "24px 0" }} />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="glass-card" title="Top Items" style={{ height: "100%" }}>
            {hasTopItems ? (
              <Tabs
                activeKey={activeStatsTab}
                onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
                items={[
                  {
                    key: "top-rated",
                    label: "Top Rated",
                    children: (data.topRatedItems ?? []).length > 0 ? (
                      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                        {(data.topRatedItems ?? []).map((item, i) => (
                          <PosterCard
                            key={i}
                            title={item.title}
                            posterPath={item.posterPath}
                            badge={`★ ${item.userRating}`}
                            mediaType={item.mediaType}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty description="Rate some items to see them here." />
                    ),
                  },
                  {
                    key: "recent",
                    label: "Recently Watched",
                    children: (data.recentItems ?? []).length > 0 ? (
                      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                        {(data.recentItems ?? []).map((item, i) => (
                          <PosterCard
                            key={i}
                            title={item.title}
                            posterPath={item.posterPath}
                            badge={item.watchedAt}
                            mediaType={item.mediaType}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty description="No recent items." />
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="Watch or rate titles to see them here." style={{ padding: "24px 0" }} />
            )}
          </Card>
        </Col>
      </Row>
    </motion.div>
  );
}

export default StatsPage;
