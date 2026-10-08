import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Row, Col, Button, Typography, Empty, Spin } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { fetchFollowedPeopleRecommendations, type PersonalizedRecSection, type FollowedPersonEntry } from "../api/userApi";
import PersonCard from "../components/PersonCard";
import FilterBar from "../components/FilterBar";
import { useLibraryFilters } from "../hooks/useLibraryFilters";
import { SectionRow } from "./RecommendationsPage";
import { pageVariants, RATING_GOLD } from "../constants/ui";
import { LoadError } from "../components/LoadError";

const { Title } = Typography;

type SortKey = "name-asc" | "name-desc";

const SORT_FNS: Record<SortKey, (a: FollowedPersonEntry, b: FollowedPersonEntry) => number> = {
  "name-asc": (a, b) => a.name.localeCompare(b.name),
  "name-desc": (a, b) => b.name.localeCompare(a.name),
};

function FollowingPage() {
  const navigate = useNavigate();
  const { followed, loading, error, retry } = useFollowedPeople();
  const [recSections, setRecSections] = useState<PersonalizedRecSection[]>([]);
  const [recError, setRecError] = useState(false);
  const [recRetry, setRecRetry] = useState(0);

  const {
    search, setSearch, sortKey, setSortKey, filtered: filteredFollowed, isDefault, resetFilters,
  } = useLibraryFilters<FollowedPersonEntry>({
    keyPrefix: "following",
    items: followed,
    sortFns: SORT_FNS,
    defaultSort: "name-asc",
    getTitle: (p) => p.name,
  });

  useEffect(() => {
    if (followed.length === 0) { setRecSections([]); setRecError(false); return; }
    let cancelled = false;
    setRecError(false);
    fetchFollowedPeopleRecommendations()
      .then((res) => { if (!cancelled) setRecSections(res.data); })
      // Say it failed rather than quietly dropping the section.
      .catch(() => { if (!cancelled) { setRecSections([]); setRecError(true); } });
    return () => { cancelled = true; };
  }, [followed.length, recRetry]);

  if (error) {
    return <LoadError title="Couldn't load who you follow" onRetry={retry} />;
  }

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
          <FilterBar
            search={{ value: search, onChange: setSearch, id: "following-search", placeholder: "Search people…" }}
            sort={{
              value: sortKey,
              onChange: setSortKey,
              maxWidth: 150,
              options: [
                { label: "Name A–Z", value: "name-asc" },
                { label: "Name Z–A", value: "name-desc" },
              ],
            }}
            showClear={!isDefault}
            onClear={resetFilters}
          />

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
          {recError && (
            <Typography.Paragraph type="secondary" style={{ marginTop: 32 }}>
              Couldn't load recommendations from people you follow.{" "}
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setRecRetry((n) => n + 1)}>
                Retry
              </Button>
            </Typography.Paragraph>
          )}
        </>
      )}
    </motion.div>
  );
}

export default FollowingPage;
