import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Typography, Button, Modal, Form, Input, Card, Row, Col, Empty,
  Space, Popconfirm, Tag, Divider, Spin,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, UnorderedListOutlined, StarFilled, DownloadOutlined,
} from "@ant-design/icons";
import { useListsContext } from "../context/useListsContext";
import { downloadCSV } from "../utils/export";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const SS_SELECTED = "lists_selected_id";

function ListsPage() {
  const navigate = useNavigate();
  const { lists, isLoading, createList, deleteList, removeFromList } = useListsContext();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem(SS_SELECTED);
    return saved ? Number(saved) : null;
  });
  const [form] = Form.useForm();

  const handleCreate = () => {
    form.validateFields().then((values) => {
      createList(values.name, values.description || "");
      form.resetFields();
      setCreateModalOpen(false);
    });
  };

  const selectList = (id: number | null) => {
    setSelectedListId(id);
    if (id !== null) sessionStorage.setItem(SS_SELECTED, String(id));
    else sessionStorage.removeItem(SS_SELECTED);
  };

  const currentSelected = selectedListId
    ? lists.find((l) => l.id === selectedListId) ?? null
    : null;

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
          <UnorderedListOutlined style={{ fontSize: 24, color: "#f5c518" }} />
          <Typography.Title level={2} style={{ margin: 0 }}>My Lists</Typography.Title>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          New List
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <Spin size="large" />
        </div>
      ) : lists.length === 0 ? (
        <Empty
          image={<UnorderedListOutlined style={{ fontSize: 48, color: "#f5c518" }} />}
          description="No custom lists yet. Create your first list to organize your favorites."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create a List
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {lists.map((list) => (
            <Col key={list.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{ cursor: "pointer", borderColor: currentSelected?.id === list.id ? "#f5c518" : undefined }}
                onClick={() => selectList(list.id === currentSelected?.id ? null : list.id)}
                actions={[
                  <Popconfirm
                    key="delete"
                    title={`Delete "${list.name}"?`}
                    description="This will permanently remove the list and all its items."
                    onConfirm={() => { if (currentSelected?.id === list.id) selectList(null); deleteList(list.id); }}
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
                <Typography.Text strong style={{ fontSize: 14, display: "block", marginBottom: 4 }}>
                  {list.name}
                </Typography.Text>
                {list.description && (
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                    {list.description}
                  </Typography.Text>
                )}
                <Space size={4}>
                  <Tag color="gold">{list.items.length} item{list.items.length !== 1 ? "s" : ""}</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(list.createdAt).toLocaleDateString()}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Selected list items */}
      {currentSelected && (
        <>
          <Divider>
            <Space>
              <Typography.Text strong>{currentSelected.name}</Typography.Text>
              {currentSelected.items.length > 0 && (
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    const rows = currentSelected.items.map((i) => ({
                      list: currentSelected.name,
                      title: i.title,
                      type: i.type,
                      tmdb_id: i.id,
                      vote_average: i.voteAverage,
                      added_at: i.addedAt,
                    }));
                    downloadCSV(rows, `${currentSelected.name.replace(/\s+/g, "_")}.csv`);
                  }}
                >
                  Export CSV
                </Button>
              )}
            </Space>
          </Divider>

          {currentSelected.items.length === 0 ? (
            <Empty
              description={`"${currentSelected.name}" is empty. Add items from movie or TV detail pages.`}
              style={{ padding: "40px 0" }}
            />
          ) : (
            <Row gutter={[16, 20]}>
              {currentSelected.items.map((item) => (
                <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4}>
                  <Card
                    hoverable
                    cover={
                      <img
                        src={item.posterPath ? `${IMG_URL}${item.posterPath}` : "https://placehold.co/300x450?text=No+Image"}
                        alt={item.title}
                        className="movie-poster-img"
                        onClick={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: "/lists" } })}
                        style={{ cursor: "pointer" }}
                      />
                    }
                    styles={{ body: { padding: "10px 12px" } }}
                    actions={[
                      <Popconfirm
                        key="remove"
                        title="Remove from list?"
                        onConfirm={() => removeFromList(currentSelected.id, item.id, item.type)}
                        okText="Remove"
                        cancelText="Cancel"
                      >
                        <Button type="link" danger icon={<DeleteOutlined />} size="small">
                          Remove
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <Typography.Text
                      strong
                      style={{ fontSize: 12, display: "block", marginBottom: 4 }}
                      ellipsis={{ tooltip: item.title }}
                    >
                      {item.title}
                    </Typography.Text>
                    <Space size={4} wrap>
                      <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0 }}>
                        {item.type === "movie" ? "Movie" : "TV"}
                      </Tag>
                      {item.voteAverage != null && (
                        <Tag color="gold" style={{ margin: 0 }}>
                          <StarFilled /> {item.voteAverage.toFixed(1)}
                        </Tag>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
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
    </motion.div>
  );
}

export default ListsPage;
