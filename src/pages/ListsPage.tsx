import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Typography, Button, Modal, Form, Input, Select, Card, Row, Col, Empty,
  Space, Popconfirm, Tag, Spin,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, UnorderedListOutlined, UploadOutlined, SearchOutlined,
} from "@ant-design/icons";

import { useListsContext } from "../context/useListsContext";
import { formatDateDMY } from "../utils/formatDate";
import { InfoTooltip } from "../components/InfoTooltip";
import { FONT_SIZE } from "../constants/typography";
import CSVListImportModal from "../components/lists/CSVListImportModal";
import { pageVariants, RATING_GOLD, IMG_URL, NO_IMAGE } from "../constants/ui";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";

const SS_SEARCH = "lists_search";
const SS_SORT = "lists_sort";

type SortKey = "created-desc" | "created-asc" | "name-asc" | "items-desc";

function ListsPage() {
  const navigate = useNavigate();
  const { lists, isLoading, createList, deleteList } = useListsContext();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importListOpen, setImportListOpen] = useState(false);
  const [search, setSearch] = useState(() => sessionStorage.getItem(SS_SEARCH) ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(() => (sessionStorage.getItem(SS_SORT) as SortKey) ?? "created-desc");
  const [form] = Form.useForm();
  const { showSuccess, showError } = useToast();

  const handleCreate = () => {
    form.validateFields().then(async (values) => {
      try {
        await createList(values.name, values.description || "");
        form.resetFields();
        setCreateModalOpen(false);
        showSuccess("List created");
      } catch (err) {
        showError(getApiError(err, "Failed to create list."));
      }
    });
  };

  const filteredLists = useMemo(() => {
    let items = [...lists];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((l) => l.name.toLowerCase().includes(q));
    }
    switch (sortKey) {
      case "created-asc": items.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")); break;
      case "name-asc":    items.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "items-desc":  items.sort((a, b) => b.items.length - a.items.length); break;
      default:            items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    }
    return items;
  }, [lists, search, sortKey]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UnorderedListOutlined style={{ fontSize: 24, color: RATING_GOLD }} />
          <Typography.Title level={2} style={{ margin: 0 }}>My Lists</Typography.Title>
        </div>
        <Space wrap>
          <Button icon={<UploadOutlined />} onClick={() => setImportListOpen(true)} size="small">
            Import to List
          </Button>
          <InfoTooltip title={<>CSV needs columns <code>id</code> (TMDB ID) and <code>title</code> — matches the format in the import dialog.</>} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            New List
          </Button>
        </Space>
      </div>

      {lists.length > 0 && (
        <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <Input
            id="lists-search"
            name="search"
            autoComplete="off"
            prefix={<SearchOutlined />}
            placeholder="Search lists…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: "100%", maxWidth: 200 }}
          />
          <Select
            value={sortKey}
            onChange={setSortKey}
            style={{ width: "100%", maxWidth: 180 }}
            options={[
              { label: "Created (newest)", value: "created-desc" },
              { label: "Created (oldest)", value: "created-asc" },
              { label: "Name A–Z", value: "name-asc" },
              { label: "Item count ↓", value: "items-desc" },
            ]}
          />
          {(search.trim() !== "" || sortKey !== "created-desc") && (
            <Button
              type="text"
              onClick={() => { setSearch(""); setSortKey("created-desc"); }}
            >
              Clear filters
            </Button>
          )}
        </Space>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <Spin size="large" />
        </div>
      ) : lists.length === 0 ? (
        <Empty
          image={<UnorderedListOutlined style={{ fontSize: 48, color: RATING_GOLD }} />}
          description="No custom lists yet. Create your first list to organize your favorites."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create a List
          </Button>
        </Empty>
      ) : filteredLists.length === 0 ? (
        <Empty
          description={search.trim() ? `No lists match "${search}".` : "No lists match your filters."}
          style={{ padding: "40px 0" }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredLists.map((list) => (
            <Col key={list.id} xs={12} sm={8} md={4} lg={4}>
              <Card
                hoverable
                className="glass-card"
                style={{ height: "100%", cursor: "pointer" }}
                onClick={() => navigate(`/lists/${list.id}`)}
                cover={
                  <img
                    src={list.items[0]?.posterPath ? `${IMG_URL}${list.items[0].posterPath}` : NO_IMAGE}
                    alt={list.name}
                    loading="lazy"
                    className="movie-poster-img"
                    style={{ aspectRatio: "2 / 3", objectFit: "cover" }}
                  />
                }
                actions={[
                  <Popconfirm
                    key="delete"
                    title={`Delete "${list.name}"?`}
                    description="This will permanently remove the list and all its items."
                    onConfirm={async () => {
                      try {
                        await deleteList(list.id);
                        showSuccess("List deleted");
                      } catch (err) {
                        showError(getApiError(err, "Failed to delete list."));
                      }
                    }}
                    okText="Delete"
                    okType="danger"
                    cancelText="Cancel"
                  >
                    <Button type="link" danger icon={<DeleteOutlined />} size="small" onClick={(e) => e.stopPropagation()}>
                      Delete
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <Typography.Text strong style={{ fontSize: FONT_SIZE.emphasis, display: "block", marginBottom: 4 }}>
                  {list.name}
                </Typography.Text>
                {list.description && (
                  <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.body, display: "block", marginBottom: 6 }}>
                    {list.description}
                  </Typography.Text>
                )}
                <Space size={4}>
                  <Tag color="gold">{list.items.length} item{list.items.length !== 1 ? "s" : ""}</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption }}>
                    {formatDateDMY(list.createdAt)}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Create List Modal */}
      <Modal
        title="Create New List"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        okText="Create"
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

      <CSVListImportModal open={importListOpen} onClose={() => setImportListOpen(false)} />
    </motion.div>
  );
}

export default ListsPage;
