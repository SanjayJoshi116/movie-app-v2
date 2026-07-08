import { Row, Col, Card, Typography } from "antd";
import { SectionHeader } from "./SectionHeader";

export interface ReviewItem {
  id: string;
  author: string;
  content: string;
}

interface ReviewsSectionProps {
  reviews: ReviewItem[];
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <>
      <SectionHeader title="Reviews" />
      <Row gutter={[16, 16]}>
        {reviews.map((review) => (
          <Col key={review.id} xs={24} md={12}>
            <Card size="small">
              <Typography.Text strong>{review.author}</Typography.Text>
              <Typography.Paragraph
                style={{ marginTop: 8, marginBottom: 0 }}
                ellipsis={{ rows: 4, expandable: true, symbol: "more" }}
              >
                {review.content}
              </Typography.Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
