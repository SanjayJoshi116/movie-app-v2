import React from "react";
import { Row, Col, Empty } from "antd";
import Movie from "./Movie";
import type { TMDBMovieSummary } from "../types";

interface Props {
  movies: TMDBMovieSummary[];
  onKnowMore: (id: number) => void;
}

function Movies({ movies, onKnowMore }: Props) {
  if (movies.length === 0) {
    return <Empty description="No results found" style={{ padding: "48px 0" }} />;
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
