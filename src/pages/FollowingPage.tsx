import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Card, Button, Typography, Empty, Avatar, Spin, Popconfirm } from "antd";
import { UserAddOutlined, UserDeleteOutlined } from "@ant-design/icons";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { useToast } from "../hooks/useToast";

const { Title, Text } = Typography;

const IMG_URL = "https://image.tmdb.org/t/p/w185";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function FollowingPage() {
  const navigate = useNavigate();
  const { followed, loading, unfollow } = useFollowedPeople();
  const { showSuccess } = useToast();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <UserAddOutlined style={{ fontSize: 24, color: "#f5c518" }} />
        <Title level={2} style={{ margin: 0 }}>
          Following ({followed.length})
        </Title>
      </div>

      {followed.length === 0 ? (
        <Empty
          image={<UserAddOutlined style={{ fontSize: 48, color: "#f5c518" }} />}
          description="You're not following anyone yet. Visit an actor or director's page and click Follow."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/people")}>Browse People</Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {followed.map((person) => (
            <Col key={person.personId} xs={12} sm={8} md={6} lg={4}>
              <Card
                hoverable
                cover={
                  person.profilePath ? (
                    <img
                      src={`${IMG_URL}${person.profilePath}`}
                      alt={person.name}
                      loading="lazy"
                      className="movie-poster-img"
                      onClick={() => navigate(`/person/${person.personId}`)}
                      style={{ cursor: "pointer" }}
                    />
                  ) : (
                    <div
                      onClick={() => navigate(`/person/${person.personId}`)}
                      style={{
                        height: 200,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <Avatar size={80} style={{ backgroundColor: "#f5c518", color: "#000", fontSize: 28 }}>
                        {person.name.slice(0, 1)}
                      </Avatar>
                    </div>
                  )
                }
                styles={{ body: { padding: "10px 12px" } }}
                actions={[
                  <Popconfirm
                    key="unfollow"
                    title={`Unfollow ${person.name}?`}
                    onConfirm={async () => {
                      await unfollow(person.personId);
                      showSuccess(`Unfollowed ${person.name}`);
                    }}
                    okText="Unfollow"
                    cancelText="Cancel"
                  >
                    <Button type="link" danger icon={<UserDeleteOutlined />} size="small">
                      Unfollow
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <Text
                  strong
                  style={{ fontSize: 12, display: "block" }}
                  ellipsis={{ tooltip: person.name }}
                >
                  {person.name}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </motion.div>
  );
}

export default FollowingPage;
