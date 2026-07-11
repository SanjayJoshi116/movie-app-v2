import { memo } from "react";
import { motion } from "framer-motion";
import { Card, Tag, Button } from "antd";
import { UserOutlined, UserAddOutlined, UserDeleteOutlined } from "@ant-design/icons";
import MarqueeTitle from "./MarqueeTitle";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { useToast } from "../hooks/useToast";
import { IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { PosterPlaceholder } from "./PosterPlaceholder";

interface PersonCardPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
}

interface Props {
  person: PersonCardPerson;
  onClick: () => void;
}

const PersonCard = ({ person, onClick }: Props) => {
  const { isFollowing, follow, unfollow } = useFollowedPeople();
  const { showSuccess } = useToast();
  const following = isFollowing(person.id);

  return (
    <motion.div
      role="article"
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      <Card
        hoverable
        className="glass-card"
        cover={
          person.profile_path ? (
            <img
              src={`${IMG_URL}${person.profile_path}`}
              alt={person.name}
              loading="lazy"
              className="movie-poster-img"
            />
          ) : (
            <PosterPlaceholder className="movie-poster-img" />
          )
        }
        styles={{ body: { padding: "10px 12px" } }}
        style={{ height: "100%" }}
        aria-label={`View profile of ${person.name}`}
      >
        <Card.Meta
          title={
            <MarqueeTitle style={{ fontSize: FONT_SIZE.emphasis, lineHeight: "1.3" }}>{person.name}</MarqueeTitle>
          }
          description={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              {person.known_for_department ? (
                <Tag icon={<UserOutlined />} color="default" style={{ margin: 0 }}>
                  {person.known_for_department}
                </Tag>
              ) : <span />}
              <Button
                size="small"
                type={following ? "default" : "primary"}
                icon={following ? <UserDeleteOutlined /> : <UserAddOutlined />}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (following) {
                    await unfollow(person.id);
                    showSuccess(`Unfollowed ${person.name}`);
                  } else {
                    await follow(person.id, person.name, person.profile_path ?? null);
                    showSuccess(`Following ${person.name}`);
                  }
                }}
                aria-label={following ? `Unfollow ${person.name}` : `Follow ${person.name}`}
              >
                {following ? "Unfollow" : "Follow"}
              </Button>
            </div>
          }
        />
      </Card>
    </motion.div>
  );
};

export default memo(PersonCard);
