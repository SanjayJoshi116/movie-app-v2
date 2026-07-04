import { Row, Col, Empty } from "antd";
import { SearchOutlined, FilterOutlined, InboxOutlined } from "@ant-design/icons";
import type { TMDBTVSummary } from "../types";
import TVShowCard from "./TVShowCard";

interface Props {
  tvShows: TMDBTVSummary[];
  onKnowMore: (id: number) => void;
  searchTerm?: string;
  hasFilters?: boolean;
}

const TVShows = ({ tvShows, onKnowMore, searchTerm, hasFilters }: Props) => {
  if (tvShows.length === 0) {
    let icon = <InboxOutlined style={{ fontSize: 48, color: "#aaa" }} />;
    let description = "No TV shows found.";

    if (searchTerm) {
      icon = <SearchOutlined style={{ fontSize: 48, color: "#aaa" }} />;
      description = `No results for "${searchTerm}". Try a different search.`;
    } else if (hasFilters) {
      icon = <FilterOutlined style={{ fontSize: 48, color: "#aaa" }} />;
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
            <TVShowCard tvShow={tvShow} onKnowMore={onKnowMore} />
          </Col>
        ))}
      </Row>
    </main>
  );
};

export default TVShows;
