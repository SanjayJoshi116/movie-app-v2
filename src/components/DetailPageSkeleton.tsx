import { Skeleton, Row, Col } from "antd";
import { motion } from "framer-motion";

function DetailPageSkeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <Skeleton.Image active style={{ width: "100%", height: 340, borderRadius: 0, display: "block" }} />
      <div className="detail-container" style={{ padding: "24px 16px" }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8} md={6}>
            <Skeleton.Image active style={{ width: "100%", height: 280, borderRadius: 12 }} />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Col>
        </Row>
      </div>
    </motion.div>
  );
}

export default DetailPageSkeleton;
