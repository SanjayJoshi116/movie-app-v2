import { Row, Col, Empty, theme } from "antd";
import { FilterOutlined, InboxOutlined } from "@ant-design/icons";
import type { MediaType, TMDBTVSummary } from "../types";
import MediaCard from "./MediaCard";
import { toMediaSummary } from "../utils/mediaSummary";

interface Props {
  tvShows: TMDBTVSummary[];
  onKnowMore: (id: number, type: MediaType) => void;
  hasFilters?: boolean;
}

const TVShows = ({ tvShows, onKnowMore, hasFilters }: Props) => {
  const { token } = theme.useToken();
  if (tvShows.length === 0) {
    let icon = <InboxOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />;
    let description = "No TV shows found.";

    if (hasFilters) {
      icon = <FilterOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />;
      description = "No TV shows match your filters. Try adjusting them.";
    }

    return (
      <Empty
        image={icon}
        description={description}
        style={{ padding: "48px 0" }}
      />
    );
  }

  return (
    <main aria-label="TV show results">
      <Row gutter={[16, 20]}>
        {tvShows.map((tvShow) => (
          <Col key={tvShow.id} xs={12} sm={8} md={6} lg={4} xl={4}>
            <MediaCard {...toMediaSummary(tvShow, "tv")} onKnowMore={onKnowMore} />
          </Col>
        ))}
      </Row>
    </main>
  );
};

export default TVShows;
