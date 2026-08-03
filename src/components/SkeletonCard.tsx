import { Row, Col, Card, Skeleton } from "antd";
import { motion } from "framer-motion";

interface Props {
  count?: number;
}

function SkeletonCard({ count = 18 }: Props) {
  return (
    <Row gutter={[16, 20]}>
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} xs={12} sm={8} md={6} lg={4} xl={4}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: (i % 12) * 0.03 }}
            style={{ height: "100%" }}
          >
            <Card styles={{ body: { padding: "10px 12px" } }} style={{ height: "100%" }}>
              <Skeleton.Image active style={{ width: "100%", aspectRatio: "2 / 3", height: "auto", borderRadius: 6 }} />
              <Skeleton active title={{ width: "80%" }} paragraph={{ rows: 1, width: "50%" }} style={{ marginTop: 10 }} />
            </Card>
          </motion.div>
        </Col>
      ))}
    </Row>
  );
}

export default SkeletonCard;
