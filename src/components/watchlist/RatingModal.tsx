import { useState } from "react";
import { Modal, Form, Input, Typography, Space } from "antd";
import { StarRating } from "../ui/StarRating";
import type { RatingEntry } from "../../types";

interface Props {
  title: string;
  existing: RatingEntry | null;
  onSave: (rating: number, review: string) => void | Promise<void>;
  onClose: () => void;
}

export function RatingModal({ title, existing, onSave, onClose }: Props) {
  const [rating, setRating] = useState(existing?.userRating ?? 0);
  const [review, setReview] = useState(existing?.review ?? "");

  const handleOk = () => {
    if (rating === 0) return;
    onSave(rating, review);
    onClose();
  };

  return (
    <Modal
      open
      title={`Rate: ${title}`}
      onOk={handleOk}
      onCancel={onClose}
      okText="Save"
      cancelText="Cancel"
      okButtonProps={{ disabled: rating === 0 }}
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
