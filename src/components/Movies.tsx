import React from "react";
import { Row, Col, Empty } from "antd";
import { SearchOutlined, FilterOutlined, InboxOutlined } from "@ant-design/icons";
import Movie from "./Movie";
import type { TMDBMovieSummary } from "../types";

interface Props {
  movies: TMDBMovieSummary[];
  onKnowMore: (id: number) => void;
  searchTerm?: string;
  hasFilters?: boolean;
}

function Movies({ movies, onKnowMore, searchTerm, hasFilters }: Props) {

  if (movies.length === 0) {
    let icon = <InboxOutlined style={{ fontSize: 48, color: "#aaa" }} />;
    let description = "No movies found.";

    if (searchTerm) {
      icon = <SearchOutlined style={{ fontSize: 48, color: "#aaa" }} />;
      description = `No results for "${searchTerm}". Try a different search.`;
    } else if (hasFilters) {
      icon = <FilterOutlined style={{ fontSize: 48, color: "#aaa" }} />;
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
    <main>
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
