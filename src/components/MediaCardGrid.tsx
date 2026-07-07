import { Row, Col, Card, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { IMG_URL, NO_IMAGE } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { SectionHeader } from "./SectionHeader";

export interface MediaCardGridItem {
  id: number;
  posterPath: string | null;
  name: string;
}

interface MediaCardGridProps {
  title: string;
  items: MediaCardGridItem[];
  mediaType: "movie" | "tv";
  limit?: number;
}

export function MediaCardGrid({ title, items, mediaType, limit = 10 }: MediaCardGridProps) {
  const navigate = useNavigate();
  if (!items || items.length === 0) return null;

  return (
    <>
      <SectionHeader title={title} />
      <Row gutter={[12, 16]}>
        {items.slice(0, limit).map((item) => (
          <Col key={item.id} xs={8} sm={6} md={4} lg={3}>
            <Card
              hoverable
              size="small"
              onClick={() => navigate(`/${mediaType}/${item.id}`)}
              cover={
                <img
                  src={item.posterPath ? `${IMG_URL}${item.posterPath}` : NO_IMAGE}
                  alt={item.name}
                  className="rec-card-img"
                  loading="lazy"
                />
              }
              styles={{ body: { padding: "6px 8px" } }}
            >
              <Typography.Text style={{ fontSize: FONT_SIZE.caption }}>{item.name}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
