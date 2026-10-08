import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Typography, Button, Modal, Form, Input, Empty, Space, Popconfirm, Tag, Spin, Tooltip,
} from "antd";
import {
  LeftOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, ClearOutlined, StarFilled,
} from "@ant-design/icons";
import { useListsContext } from "../context/useListsContext";
import { useToast } from "../hooks/useToast";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { downloadCSV } from "../utils/export";
import { getApiError } from "../utils/apiError";
import LibraryItemCard from "../components/LibraryItemCard";
import { LoadError } from "../components/LoadError";
import FilterBar from "../components/FilterBar";
import MediaGrid from "../components/MediaGrid";
import CSVListImportModal from "../components/lists/CSVListImportModal";
import { FONT_SIZE } from "../constants/typography";
import { pageVariants } from "../constants/ui";
import type { WatchlistEntry } from "../types";

const SORT_FNS = {
  "added-desc": (a: WatchlistEntry, b: WatchlistEntry) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""),
  "added-asc": (a: WatchlistEntry, b: WatchlistEntry) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""),
  "title-asc": (a: WatchlistEntry, b: WatchlistEntry) => a.title.localeCompare(b.title),
  "rating-desc": (a: WatchlistEntry, b: WatchlistEntry) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0),
};

function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const listId = Number(id);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { lists, isLoading, error: loadError, reloadLists, deleteList, updateList, removeFromList, clearList } = useListsContext();
  const list = lists.find((l) => l.id === listId) ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form] = Form.useForm();

  const {
    search, setSearch, sortKey, setSortKey, typeFilter, setTypeFilter,
    filtered: filteredItems, isDefault, resetFilters,
  } = useLibraryFilters<WatchlistEntry>({
    keyPrefix: `listdetail_${listId}`,
    items: list?.items ?? [],
    sortFns: SORT_FNS,
    defaultSort: "added-desc",
  });

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

  const [saving, setSaving] = useState(false);
  const handleEditSubmit = () => {
    if (!list || saving) return;
    form.validateFields().then(async (values) => {
      setSaving(true);
      try {
        await updateList(list.id, values);
        showSuccess("List updated");
        setEditOpen(false);
      } catch (err) {
        showError(getApiError(err, "Failed to update list."));
      } finally {
        setSaving(false);
      }
    });
  };

  // Only block the page while there's nothing to show yet: a background reload
  // (e.g. after importing into this list) must not unmount the open modal.
  if (!list && isLoading) {
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
        {loadError ? (
          <LoadError title="Couldn't load your lists" onRetry={() => { reloadLists().catch(() => {}); }} />
        ) : (
          <Empty description="List not found." style={{ padding: "60px 0" }} />
        )}
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
              onConfirm={async () => {
                try {
                  await clearList(list.id);
                  showSuccess("List cleared");
                } catch (err) {
                  showError(getApiError(err, "Failed to clear list."));
                }
              }}
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
              onConfirm={async () => {
                try {
                  await deleteList(list.id);
                  showSuccess("List deleted");
                  navigate("/lists");
                } catch (err) {
                  showError(getApiError(err, "Failed to delete list."));
                }
              }}
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
          <FilterBar
            search={{ value: search, onChange: setSearch, id: "list-detail-search", placeholder: "Search title…" }}
            sort={{
              value: sortKey,
              onChange: setSortKey,
              maxWidth: 170,
              options: [
                { label: "Added (newest)", value: "added-desc" },
                { label: "Added (oldest)", value: "added-asc" },
                { label: "Title A–Z", value: "title-asc" },
                { label: "TMDB Rating ↓", value: "rating-desc" },
              ],
            }}
            typeFilter={{ value: typeFilter, onChange: setTypeFilter }}
            showClear={!isDefault}
            onClear={resetFilters}
          />
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
          <MediaGrid
            items={filteredItems}
            colSpan={{ md: 4 }}
            keyFn={(item) => `${item.type}-${item.id}`}
            renderCard={(item) => (
              <LibraryItemCard
                posterPath={item.posterPath}
                title={item.title}
                to={`/${item.type}/${item.id}`}
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
                    onConfirm={async () => {
                      try {
                        await removeFromList(list.id, item.id, item.type);
                      } catch (err) {
                        showError(getApiError(err, "Failed to remove from list."));
                      }
                    }}
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
            )}
          />
        )}
      </div>

      <Modal
        title="Edit List"
        open={editOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditOpen(false)}
        okText="Save"
        confirmLoading={saving}
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
