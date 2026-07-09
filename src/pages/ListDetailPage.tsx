import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Typography, Button, Modal, Form, Input, Select, Row, Col, Empty, Space, Popconfirm, Tag, Spin, Tooltip,
} from "antd";
import {
  LeftOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, ClearOutlined, SearchOutlined, StarFilled,
} from "@ant-design/icons";
import { useListsContext } from "../context/useListsContext";
import { useToast } from "../hooks/useToast";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import LibraryItemCard from "../components/LibraryItemCard";
import CSVListImportModal from "../components/lists/CSVListImportModal";
import { FONT_SIZE } from "../constants/typography";
import { pageVariants } from "../constants/ui";

const SS_SEARCH = "listdetail_search";
const SS_SORT = "listdetail_sort";
const SS_TYPE_FILTER = "listdetail_type_filter";

type SortKey = "added-desc" | "added-asc" | "title-asc" | "rating-desc";
type TypeFilter = "all" | "movie" | "tv";

function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const listId = Number(id);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { lists, isLoading, deleteList, updateList, removeFromList, clearList } = useListsContext();
  const list = lists.find((l) => l.id === listId) ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form] = Form.useForm();

  const [search, setSearch] = useState(() => sessionStorage.getItem(SS_SEARCH) ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(() => (sessionStorage.getItem(SS_SORT) as SortKey) ?? "added-desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => (sessionStorage.getItem(SS_TYPE_FILTER) as TypeFilter) ?? "all");

  useEffect(() => { sessionStorage.setItem(SS_SEARCH, search); }, [search]);
  useEffect(() => { sessionStorage.setItem(SS_SORT, sortKey); }, [sortKey]);
  useEffect(() => { sessionStorage.setItem(SS_TYPE_FILTER, typeFilter); }, [typeFilter]);

  const filteredItems = useMemo(() => {
    if (!list) return [];
    let items = [...list.items];
    if (typeFilter !== "all") {
      items = items.filter((i) => i.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q));
    }
    switch (sortKey) {
      case "added-asc":  items.sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? "")); break;
      case "title-asc":  items.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "rating-desc": items.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0)); break;
      default:           items.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
    }
    return items;
  }, [list, search, sortKey, typeFilter]);

  const handleExport = () => {
    if (!list) return;
    const rows = list.items.map((i) => ({
      list: list.name,
      title: i.title,
      type: i.type,
      tmdb_id: i.id,
      vote_average: i.voteAverage,
      added_at: i.addedAt,
    }));
    downloadCSV(rows, `${list.name.replace(/\s+/g, "_")}.csv`);
  };

  const openEdit = () => {
    if (!list) return;
    form.setFieldsValue({ name: list.name, description: list.description });
    setEditOpen(true);
  };

  const handleEditSubmit = () => {
    if (!list) return;
    form.validateFields().then(async (values) => {
      try {
        await updateList(list.id, values);
        showSuccess("List updated");
        setEditOpen(false);
      } catch (err) {
        showError(getApiError(err, "Failed to update list."));
      }
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="detail-container">
        <Button icon={<LeftOutlined />} onClick={() => navigate("/lists")} style={{ marginBottom: 16 }}>
          Back
        </Button>
        <Empty description="List not found." style={{ padding: "60px 0" }} />
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div className="detail-container" style={{ paddingBottom: 16 }}>
        <Button icon={<LeftOutlined />} onClick={() => navigate("/lists")} style={{ marginBottom: 16 }}>
          Back
        </Button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Typography.Title level={2} style={{ margin: 0 }}>{list.name}</Typography.Title>
            <Tooltip title="Edit list">
              <Button type="text" icon={<EditOutlined />} onClick={openEdit} aria-label="Edit list" />
            </Tooltip>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={list.items.length === 0}>
              Export CSV
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Import to This List
            </Button>
            <Popconfirm
              title="Clear all items from this list?"
              description="The list will remain but all items will be removed."
              onConfirm={async () => { await clearList(list.id); showSuccess("List cleared"); }}
              okText="Clear All"
              okType="danger"
              cancelText="Cancel"
            >
              <Button danger icon={<ClearOutlined />} disabled={list.items.length === 0}>
                Clear All
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Delete "${list.name}"?`}
              description="This will permanently remove the list and all its items."
              onConfirm={async () => { await deleteList(list.id); showSuccess("List deleted"); navigate("/lists"); }}
              okText="Delete"
              okType="danger"
              cancelText="Cancel"
            >
              <Button danger icon={<DeleteOutlined />}>
                Delete List
              </Button>
            </Popconfirm>
          </Space>
        </div>

        {list.description && (
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: FONT_SIZE.body }}>
            {list.description}
          </Typography.Text>
        )}

        {list.items.length > 0 && (
          <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <Input
              id="list-detail-search"
              name="search"
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: "100%", maxWidth: 200 }}
            />
            <Select
              value={sortKey}
              onChange={setSortKey}
              style={{ width: "100%", maxWidth: 170 }}
              options={[
                { label: "Added (newest)", value: "added-desc" },
                { label: "Added (oldest)", value: "added-asc" },
                { label: "Title A–Z", value: "title-asc" },
                { label: "TMDB Rating ↓", value: "rating-desc" },
              ]}
            />
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: "100%", maxWidth: 130 }}
              options={[
                { label: "All Types", value: "all" },
                { label: "Movies", value: "movie" },
                { label: "TV Shows", value: "tv" },
              ]}
            />
            {(search.trim() !== "" || typeFilter !== "all" || sortKey !== "added-desc") && (
              <Button
                type="text"
                onClick={() => { setSearch(""); setSortKey("added-desc"); setTypeFilter("all"); }}
              >
                Clear filters
              </Button>
            )}
          </Space>
        )}

        {list.items.length === 0 ? (
          <Empty
            description={`"${list.name}" is empty. Add items from movie or TV detail pages, or import a CSV.`}
            style={{ padding: "40px 0" }}
          />
        ) : filteredItems.length === 0 ? (
          <Empty
            description={search.trim() ? `No results for "${search}"` : "No items match your filters."}
            style={{ padding: "40px 0" }}
          />
        ) : (
          <Row gutter={[16, 20]}>
            {filteredItems.map((item) => (
              <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={4} lg={4}>
                <LibraryItemCard
                  posterPath={item.posterPath}
                  title={item.title}
                  onOpen={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: `/lists/${list.id}` } })}
                  tags={
                    <>
                      <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0 }}>
                        {item.type === "movie" ? "Movie" : "TV"}
                      </Tag>
                      {item.voteAverage != null && (
                        <Tag color="gold" style={{ margin: 0 }}>
                          <StarFilled /> {item.voteAverage.toFixed(1)}
                        </Tag>
                      )}
                    </>
                  }
                  actionButtons={
                    <Popconfirm
                      title="Remove from list?"
                      onConfirm={() => removeFromList(list.id, item.id, item.type)}
                      okText="Remove"
                      cancelText="Cancel"
                    >
                      <Tooltip title="Remove">
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Remove from list"
                        />
                      </Tooltip>
                    </Popconfirm>
                  }
                />
              </Col>
            ))}
          </Row>
        )}
      </div>

      <Modal
        title="Edit List"
        open={editOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditOpen(false)}
        okText="Save"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="List Name"
            rules={[{ required: true, message: "Please enter a list name" }]}
          >
            <Input placeholder="e.g. Horror Favorites, Date Night Movies" maxLength={60} />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea placeholder="What's this list for?" maxLength={200} rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <CSVListImportModal open={importOpen} onClose={() => setImportOpen(false)} lockedListId={list.id} />
    </motion.div>
  );
}

export default ListDetailPage;
