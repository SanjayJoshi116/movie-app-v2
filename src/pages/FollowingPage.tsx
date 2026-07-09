import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Button, Typography, Empty, Spin, Space, Input, Select } from "antd";
import { UserAddOutlined, SearchOutlined } from "@ant-design/icons";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { fetchFollowedPeopleRecommendations, type PersonalizedRecSection } from "../api/userApi";
import PersonCard from "../components/PersonCard";
import { SectionRow } from "./RecommendationsPage";
import { pageVariants, RATING_GOLD } from "../constants/ui";

const { Title } = Typography;

const SS_SEARCH = "following_search";
const SS_SORT = "following_sort";

type SortKey = "name-asc" | "name-desc";

function FollowingPage() {
  const navigate = useNavigate();
  const { followed, loading } = useFollowedPeople();
  const [search, setSearch] = useState(() => sessionStorage.getItem(SS_SEARCH) ?? "");
  const [sortKey, setSortKey] = useState<SortKey>(() => (sessionStorage.getItem(SS_SORT) as SortKey) ?? "name-asc");
  const [recSections, setRecSections] = useState<PersonalizedRecSection[]>([]);

  useEffect(() => { sessionStorage.setItem(SS_SEARCH, search); }, [search]);
  useEffect(() => { sessionStorage.setItem(SS_SORT, sortKey); }, [sortKey]);

  useEffect(() => {
    if (followed.length === 0) { setRecSections([]); return; }
    fetchFollowedPeopleRecommendations()
      .then((res) => setRecSections(res.data))
      .catch(() => setRecSections([]));
  }, [followed.length]);

  const filteredFollowed = useMemo(() => {
    let items = [...followed];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    items.sort((a, b) => sortKey === "name-asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return items;
  }, [followed, search, sortKey]);

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
        <UserAddOutlined style={{ fontSize: 24, color: RATING_GOLD }} />
        <Title level={2} style={{ margin: 0 }}>
          Following ({followed.length})
        </Title>
      </div>

      {followed.length === 0 ? (
        <Empty
          image={<UserAddOutlined style={{ fontSize: 48, color: RATING_GOLD }} />}
          description="You're not following anyone yet. Visit an actor or director's page and click Follow."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/people")}>Browse People</Button>
        </Empty>
      ) : (
        <>
          <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <Input
              id="following-search"
              name="search"
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: "100%", maxWidth: 200 }}
            />
            <Select
              value={sortKey}
              onChange={setSortKey}
              style={{ width: "100%", maxWidth: 150 }}
              options={[
                { label: "Name A–Z", value: "name-asc" },
                { label: "Name Z–A", value: "name-desc" },
              ]}
            />
            {(search.trim() !== "" || sortKey !== "name-asc") && (
              <Button
                type="text"
                onClick={() => { setSearch(""); setSortKey("name-asc"); }}
              >
                Clear filters
              </Button>
            )}
          </Space>

          {filteredFollowed.length === 0 ? (
            <Empty description={`No results for "${search}"`} style={{ padding: "40px 0" }} />
          ) : (
            <Row gutter={[16, 16]}>
              {filteredFollowed.map((person) => (
                <Col key={person.personId} xs={12} sm={8} md={6} lg={4}>
                  <PersonCard
                    person={{ id: person.personId, name: person.name, profile_path: person.profilePath }}
                    onClick={() => navigate(`/person/${person.personId}`)}
                  />
                </Col>
              ))}
            </Row>
          )}

          {recSections.length > 0 && (
            <>
              <Title level={4} style={{ marginTop: 32, marginBottom: 16 }}>
                Recommended From People You Follow
              </Title>
              {recSections.map((section) => (
                <SectionRow key={section.key} section={section} navigate={navigate} />
              ))}
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

export default FollowingPage;
