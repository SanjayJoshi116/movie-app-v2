import type { ReactNode } from "react";
import { Row, Col } from "antd";

interface ColSpan {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
}

const DEFAULT_COL_SPAN: Required<ColSpan> = { xs: 12, sm: 8, md: 6, lg: 4 };

interface Props<T> {
  items: T[];
  keyFn: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  colSpan?: ColSpan;
}

function MediaGrid<T>({ items, keyFn, renderCard, colSpan }: Props<T>) {
  const span = { ...DEFAULT_COL_SPAN, ...colSpan };
  return (
    <Row gutter={[16, 20]}>
      {items.map((item) => (
        <Col key={keyFn(item)} xs={span.xs} sm={span.sm} md={span.md} lg={span.lg}>
          {renderCard(item)}
        </Col>
      ))}
    </Row>
  );
}

export default MediaGrid;
