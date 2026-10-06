import { useState } from "react";
import { Modal, Form, Input, Typography, Space, Button, Popconfirm } from "antd";
import { StarRating } from "../ui/StarRating";
import type { RatingEntry } from "../../types";

interface Props {
  title: string;
  existing: RatingEntry | null;
  /** Should reject on failure (after showing its own error) so the dialog stays open with the user's input. */
  onSave: (rating: number, review: string) => Promise<void>;
  /** Offered only when `existing` is set. Same rejection contract as `onSave`. */
  onRemove?: () => Promise<void>;
  onClose: () => void;
}

export function RatingModal({ title, existing, onSave, onRemove, onClose }: Props) {
  const [rating, setRating] = useState(existing?.userRating ?? 0);
  const [review, setReview] = useState(existing?.review ?? "");

  const [busy, setBusy] = useState<"save" | "remove" | null>(null);

  // Close only once the write succeeds; on failure the caller has already shown
  // the error, and the stars/review stay as typed so the user can retry.
  const run = async (kind: "save" | "remove", action: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await action();
      onClose();
    } catch {
      setBusy(null);
    }
  };

  const handleOk = () => {
    if (rating === 0) return;
    run("save", () => onSave(rating, review));
  };

  return (
    <Modal
      open
      title={`Rate: ${title}`}
      onOk={handleOk}
      onCancel={onClose}
      okText="Save"
      cancelText="Cancel"
      confirmLoading={busy === "save"}
      okButtonProps={{ disabled: rating === 0 || busy === "remove" }}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          {existing && onRemove && (
            <Popconfirm
              title="Remove your rating?"
              onConfirm={() => run("remove", onRemove)}
              okText="Remove"
              okType="danger"
              cancelText="Cancel"
            >
              <Button danger loading={busy === "remove"} disabled={busy === "save"} style={{ float: "left" }}>
                Remove rating
              </Button>
            </Popconfirm>
          )}
          <CancelBtn />
          <OkBtn />
        </>
      )}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <StarRating value={rating} onChange={setRating} />
          <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
            {rating > 0 ? `${rating} / 10` : "Select a rating"}
          </Typography.Text>
        </div>

        <Form.Item label="Review" style={{ marginBottom: 0 }}>
          <Input.TextArea
            rows={4}
            placeholder="Write a review (optional)…"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            aria-label="Review text"
          />
        </Form.Item>
      </Space>
    </Modal>
  );
}
