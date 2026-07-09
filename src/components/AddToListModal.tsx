import { useState, useMemo } from "react";
import { Modal, Input, List, Tag, Typography, Checkbox, Empty, Button } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { useListsContext } from "../context/useListsContext";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";
import { FONT_SIZE } from "../constants/typography";
import type { MediaType } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
}

export function AddToListModal({ open, onClose, mediaId, mediaType, title, posterPath, voteAverage }: Props) {
  const { lists, addToList, removeFromList, isInList, createList } = useListsContext();
  const { showSuccess, showError } = useToast();
  const [search, setSearch] = useState("");
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, search]);

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createList(name, "");
      setNewListName("");
      showSuccess(`Created "${name}"`);
    } catch (err) {
      showError(getApiError(err, "Failed to create list."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      title="Add to List"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 12, marginTop: 8 }}>
        <Input
          placeholder="New list name…"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onPressEnter={handleCreate}
          maxLength={60}
        />
        <Button icon={<PlusOutlined />} onClick={handleCreate} loading={creating} disabled={!newListName.trim()}>
          Create
        </Button>
      </div>

      {lists.length > 0 && (
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search lists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 12 }}
        />
      )}

      {lists.length === 0 ? (
        <Empty description="No lists yet. Create one above to get started." style={{ padding: "24px 0" }} />
      ) : filteredLists.length === 0 ? (
        <Typography.Text type="secondary">No lists match "{search}".</Typography.Text>
      ) : (
        <List
          dataSource={filteredLists}
          renderItem={(list) => {
            const inList = isInList(list.id, mediaId, mediaType);
            return (
              <List.Item
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (inList) {
                    removeFromList(list.id, mediaId, mediaType);
                    showSuccess(`Removed from "${list.name}"`);
                  } else {
                    addToList(list.id, { id: mediaId, type: mediaType, title, posterPath, voteAverage });
                    showSuccess(`Added to "${list.name}"`);
                  }
                }}
                actions={[<Checkbox key="check" checked={inList} onChange={() => {}} />]}
              >
                <List.Item.Meta
                  title={<Typography.Text strong>{list.name}</Typography.Text>}
                  description={
                    <Tag color="gold" style={{ fontSize: FONT_SIZE.caption }}>
                      {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                    </Tag>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Modal>
  );
}

