import { Row, Col, Empty, theme } from "antd";
import { FilterOutlined, InboxOutlined } from "@ant-design/icons";
import Movie from "./Movie";
import type { TMDBMovieSummary } from "../types";

interface Props {
  movies: TMDBMovieSummary[];
  onKnowMore: (id: number) => void;
  hasFilters?: boolean;
}

function Movies({ movies, onKnowMore, hasFilters }: Props) {
  const { token } = theme.useToken();

  if (movies.length === 0) {
    let icon = <InboxOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />;
    let description = "No movies found.";

    if (hasFilters) {
      icon = <FilterOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />;
      description = "No movies match your filters. Try adjusting them.";
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
    <main aria-label="Movie results">
      <Row gutter={[16, 20]}>
        {movies.map((movie) => (
          <Col key={movie.id} xs={12} sm={8} md={6} lg={4} xl={4}>
            <Movie
              movie={movie}
              onKnowMore={() => onKnowMore(movie.id)}
            />
          </Col>
        ))}
      </Row>
    </main>
  );
}

export default Movies;
