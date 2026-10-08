import { memo } from "react";
import { motion } from "framer-motion";
import { Card, Tag, Button, Tooltip } from "antd";
import { UserOutlined, UserAddOutlined, UserDeleteOutlined } from "@ant-design/icons";
import MarqueeTitle from "./MarqueeTitle";
import { useFollowedPeople } from "../hooks/useFollowedPeople";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";
import { IMG_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { PosterPlaceholder } from "./PosterPlaceholder";
import CardLink from "./CardLink";

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
  const { isFollowing, follow, unfollow, error: followStatusError } = useFollowedPeople();
  const { showSuccess, showError } = useToast();
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
          // Poster-only link: the Follow button below must stay outside it.
          // The card-level onClick above stays for mouse users.
          <CardLink to={`/person/${person.id}`} onNavigate={onClick} stopPropagation label={`View profile of ${person.name}`}>
            {person.profile_path ? (
              <img
                src={`${IMG_URL}${person.profile_path}`}
                alt={person.name}
                loading="lazy"
                className="movie-poster-img"
              />
            ) : (
              <PosterPlaceholder className="movie-poster-img" />
            )}
          </CardLink>
        }
        styles={{ body: { padding: "10px 12px" } }}
        style={{ height: "100%" }}
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
              {/* While the followed list failed to load, "Follow" would be a guess. */}
              <Tooltip title={followStatusError ? "Couldn't load who you follow. Retry from the Following page." : undefined}>
              <Button
                size="small"
                disabled={followStatusError}
                type={following ? "default" : "primary"}
                icon={following ? <UserDeleteOutlined /> : <UserAddOutlined />}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    if (following) {
                      await unfollow(person.id);
                      showSuccess(`Unfollowed ${person.name}`);
                    } else {
                      await follow(person.id, person.name, person.profile_path ?? null);
                      showSuccess(`Following ${person.name}`);
                    }
                  } catch (err) {
                    showError(getApiError(err, "Failed to update follow status."));
                  }
                }}
                aria-label={following ? `Unfollow ${person.name}` : `Follow ${person.name}`}
              >
                {following ? "Unfollow" : "Follow"}
              </Button>
              </Tooltip>
            </div>
          }
        />
      </Card>
    </motion.div>
  );
};

export default memo(PersonCard);
