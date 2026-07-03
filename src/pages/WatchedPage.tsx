import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Card, Button, Tag, Typography, Empty, Space, Popconfirm, Pagination, Input, Select,
} from "antd";
import { StarFilled, DeleteOutlined, EyeFilled, EyeOutlined, ClearOutlined, DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import { pageVariants, IMG_URL, NO_IMAGE } from "../constants/ui";

type SortKey = "watched-desc" | "title-asc" | "tmdb-desc" | "my-rating-desc";

function WatchedPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { watchedList, removeFromWatched, clearAllWatched, getRating } = useAppContext();
  const { showSuccess, showError } = useToast();
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("watched-desc");

  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "48") || 48;

  const setPageState = (p: number, ps: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (p === 1) next.delete("page"); else next.set("page", String(p));
      if (ps === 48) next.delete("pageSize"); else next.set("pageSize", String(ps));
      return next;
    }, { replace: true });
  };

  const buildFromUrl = () => {
    const p = new URLSearchParams();
    if (page > 1) p.set("page", String(page));
    if (pageSize !== 48) p.set("pageSize", String(pageSize));
    const qs = p.toString();
    return qs ? `/watched?${qs}` : "/watched";
  };

  const filtered = useMemo(() => {
    let items = [...watchedList];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    switch (sortKey) {
      case "title-asc":     items.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "tmdb-desc":     items.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0)); break;
      case "my-rating-desc": {
        items.sort((a, b) => {
          const ra = getRating(a.id, a.type)?.userRating ?? 0;
          const rb = getRating(b.id, b.type)?.userRating ?? 0;
          return rb - ra;
        });
        break;
      }
      default: items.sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""));
    }
    return items;
  }, [watchedList, search, sortKey, getRating]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const movies = watchedList.filter((w) => w.type === "movie");
  const tvShows = watchedList.filter((w) => w.type === "tv");

  const handleExport = () => {
    const rows = watchedList.map((i) => ({
      title: i.title,
      type: i.type,
      tmdb_id: i.id,
      vote_average: i.voteAverage,
      watched_at: i.watchedAt,
    }));
    downloadCSV(rows, "watched.csv");
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <EyeFilled style={{ color: "#52c41a", fontSize: 24 }} />
        <Typography.Title level={2} style={{ margin: 0, flex: 1 }}>
          Watched ({watchedList.length})
        </Typography.Title>
        {watchedList.length > 0 && (
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport} size="small">
              Export CSV
            </Button>
            <Popconfirm
              title="Clear all watched?"
              description="This will permanently remove all watched entries."
              onConfirm={async () => {
                setClearing(true);
                try {
                  await clearAllWatched();
                  showSuccess("Cleared all watched entries.");
                } catch (err) {
                  showError(getApiError(err, "Failed to clear watched list."));
                } finally {
                  setClearing(false);
                }
              }}
              okText="Clear All"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
            >
              <Button danger icon={<ClearOutlined />} loading={clearing}>
                Clear All
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>

      {watchedList.length > 0 && (
        <Space size={16} style={{ marginBottom: 16 }}>
          <Tag color="blue">{movies.length} movie{movies.length !== 1 ? "s" : ""}</Tag>
          <Tag color="purple">{tvShows.length} TV show{tvShows.length !== 1 ? "s" : ""}</Tag>
        </Space>
      )}

      {watchedList.length > 0 && (
        <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search title…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageState(1, pageSize); }}
            allowClear
            style={{ width: 200 }}
          />
          <Select
            value={sortKey}
            onChange={(v) => { setSortKey(v); setPageState(1, pageSize); }}
            style={{ width: 180 }}
            options={[
              { label: "Watched (newest)", value: "watched-desc" },
              { label: "Title A–Z", value: "title-asc" },
              { label: "TMDB Rating ↓", value: "tmdb-desc" },
              { label: "My Rating ↓", value: "my-rating-desc" },
            ]}
          />
        </Space>
      )}

      {watchedList.length === 0 ? (
        <Empty
          image={<EyeOutlined style={{ fontSize: 48, color: "#52c41a" }} />}
          description="Nothing marked as watched yet. Browse movies and TV shows and click the eye icon."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/movies")}>Browse Movies</Button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty description={`No results for "${search}"`} style={{ padding: "40px 0" }} />
      ) : (
        <>
          <Row gutter={[16, 20]}>
            {paginated.map((item) => (
              <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4}>
                <Card
                  hoverable
                  cover={
                    <img
                      src={item.posterPath ? `${IMG_URL}${item.posterPath}` : NO_IMAGE}
                      alt={item.title}
                      loading="lazy"
                      className="movie-poster-img"
                      onClick={() =>
                        navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: buildFromUrl() } })
                      }
                      style={{ cursor: "pointer" }}
                    />
                  }
                  styles={{ body: { padding: "10px 12px" } }}
                  actions={[
                    <Popconfirm
                      key="remove"
                      title="Remove from watched?"
                      onConfirm={() => { removeFromWatched(item.id, item.type); showSuccess("Removed from watched"); }}
                      okText="Remove"
                      cancelText="Cancel"
                    >
                      <Button type="link" danger icon={<DeleteOutlined />} size="small">Remove</Button>
                    </Popconfirm>,
                  ]}
                >
                  <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }} ellipsis={{ tooltip: item.title }}>
                    {item.title}
                  </Typography.Text>
                  <Space size={4} wrap>
                    <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0 }}>
                      {item.type === "movie" ? "Movie" : "TV"}
                    </Tag>
                    {item.voteAverage != null && (
                      <Tag color="gold" style={{ margin: 0 }}><StarFilled /> {item.voteAverage.toFixed(1)}</Tag>
                    )}
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 10, display: "block", marginTop: 6 }}>
                    {new Date(item.watchedAt).toLocaleDateString()}
                  </Typography.Text>
                </Card>
              </Col>
            ))}
          </Row>

          {filtered.length > pageSize && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filtered.length}
                showSizeChanger
                pageSizeOptions={[12, 24, 48, 96]}
                onChange={(p, ps) => {
                  setPageState(ps !== pageSize ? 1 : p, ps);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                showTotal={(total) => `${total} titles`}
              />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

export default WatchedPage;
