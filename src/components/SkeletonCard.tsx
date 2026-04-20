import React from "react";
import { Row, Col, Card, Skeleton } from "antd";

interface Props {
  count?: number;
}

function SkeletonCard({ count = 18 }: Props) {
  return (
    <Row gutter={[16, 20]}>
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} xs={12} sm={8} md={6} lg={4} xl={4}>
          <Card styles={{ body: { padding: "10px 12px" } }}>
            <Skeleton.Image active style={{ width: "100%", height: 220, borderRadius: 4 }} />
            <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 8 }} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

export default SkeletonCard;
