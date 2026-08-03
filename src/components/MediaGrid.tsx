import type { ReactNode } from "react";
import { Row, Col } from "antd";

interface Props<T> {
  items: T[];
  keyFn: (item: T) => string;
  renderCard: (item: T) => ReactNode;
}

function MediaGrid<T>({ items, keyFn, renderCard }: Props<T>) {
  return (
    <Row gutter={[16, 20]}>
      {items.map((item) => (
        <Col key={keyFn(item)} xs={12} sm={8} md={6} lg={4}>
          {renderCard(item)}
        </Col>
      ))}
    </Row>
  );
}

export default MediaGrid;
