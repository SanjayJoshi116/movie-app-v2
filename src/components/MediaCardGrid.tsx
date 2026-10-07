import { Row, Col, Card, Typography } from "antd";
import { IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { SectionHeader } from "./SectionHeader";
import { PosterPlaceholder } from "./PosterPlaceholder";
import CardLink from "./CardLink";

export interface MediaCardGridItem {
  id: number;
  posterPath: string | null;
  name: string;
  subtitle?: string;
}

interface MediaCardGridProps {
  title?: string;
  items: MediaCardGridItem[];
  mediaType: "movie" | "tv";
  limit?: number;
}

export function MediaCardGrid({ title, items, mediaType, limit = 20 }: MediaCardGridProps) {
  if (!items || items.length === 0) return null;

  return (
    <>
      {title && <SectionHeader title={title} />}
      <Row gutter={[12, 16]}>
        {items.slice(0, limit).map((item) => (
          <Col key={item.id} xs={8} sm={6} md={4} lg={3}>
            <CardLink to={`/${mediaType}/${item.id}`} label={item.name}>
            <Card
              hoverable
              size="small"
              cover={
                item.posterPath ? (
                  <img
                    src={`${IMG_URL}${item.posterPath}`}
                    alt={item.name}
                    className="rec-card-img"
                    loading="lazy"
                  />
                ) : (
                  <PosterPlaceholder className="rec-card-img" />
                )
              }
              styles={{ body: { padding: "6px 8px" } }}
            >
              <Typography.Text style={{ fontSize: FONT_SIZE.caption, display: "block" }}>{item.name}</Typography.Text>
              {item.subtitle && (
                <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption }}>{item.subtitle}</Typography.Text>
              )}
            </Card>
            </CardLink>
          </Col>
        ))}
      </Row>
    </>
  );
}
