import { Link } from "react-router-dom";
import { Col, Row, Typography, theme } from "antd";
import CardLink from "./CardLink";
import { InfoTooltip } from "./InfoTooltip";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { mediaLabel } from "../utils/mediaLabel";
import { titleKey } from "../utils/titleKey";
import { FONT_SIZE } from "../constants/typography";
import { POSTER_THUMB_URL } from "../constants/ui";
import type { RatingHabitItem, RatingHabits } from "../api/userApi";

const { Text } = Typography;

/** An average gap within this of zero reads as "in line with TMDB". */
const IN_LINE_BAND = 0.2;

const oneDecimal = (n: number) => n.toFixed(1);
/** A user rating as given (8 or 7.5), never "8.0". */
const userScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function habitSentence(avgOffset: number): string {
  if (avgOffset > IN_LINE_BAND) return `You rate ${oneDecimal(avgOffset)} above TMDB on average`;
  if (avgOffset < -IN_LINE_BAND) return `You rate ${oneDecimal(-avgOffset)} below TMDB on average`;
  return "You rate in line with TMDB on average";
}

function TakeRow({ item }: { item: RatingHabitItem }) {
  const { token } = theme.useToken();
  const title = mediaLabel(item.title, item.mediaId);
  const scores = `You ${userScore(item.userRating)} · TMDB ${oneDecimal(item.tmdbRating)}`;
  return (
    <li style={{ listStyle: "none" }}>
      <CardLink to={`/${item.mediaType}/${item.mediaId}`} label={`${title}: ${scores}`} className="hot-take-row">
        {item.posterPath ? (
          <img src={`${POSTER_THUMB_URL}${item.posterPath}`} alt="" className="hot-take-poster" />
        ) : (
          <PosterPlaceholder className="hot-take-poster" aria-hidden>{" "}</PosterPlaceholder>
        )}
        <span style={{ minWidth: 0 }}>
          <Text ellipsis style={{ display: "block", fontSize: FONT_SIZE.body }}>{title}</Text>
          <span style={{ fontSize: FONT_SIZE.caption, color: token.colorTextSecondary }}>{scores}</span>
        </span>
      </CardLink>
    </li>
  );
}

function TakeList({ heading, items, empty }: { heading: string; items: RatingHabitItem[]; empty: string }) {
  return (
    <div>
      <Typography.Title level={5} style={{ marginTop: 0 }}>{heading}</Typography.Title>
      {items.length > 0 ? (
        <ul style={{ padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {items.map((item) => <TakeRow key={titleKey(item.mediaId, item.mediaType)} item={item} />)}
        </ul>
      ) : (
        <Text type="secondary">{empty}</Text>
      )}
    </div>
  );
}

/** Stats' Hot takes: how the user's ratings compare with TMDB's community score. */
export function HotTakes({ habits }: { habits: RatingHabits }) {
  const { token } = theme.useToken();
  if (habits.avgOffset === null) {
    const missing = habits.minCount - habits.count;
    const titles = `${missing} more watched title${missing === 1 ? "" : "s"}`;
    // Every watched title already rated: the rest have no TMDB score, so the
    // rate page would be empty.
    return habits.unratedCount > 0 ? (
      <Text type="secondary">
        Rate {titles} to see your hot takes.{" "}
        <Link to="/watched/rate">Rate your watched titles</Link>
      </Text>
    ) : (
      <Text type="secondary">
        Hot takes need {titles} with a TMDB score. Everything you've watched is already rated.
      </Text>
    );
  }
  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={14}>
          <Text style={{ fontSize: FONT_SIZE.emphasis }}>{habitSentence(habits.avgOffset)}.</Text>
          <Text type="secondary" style={{ display: "block", fontSize: FONT_SIZE.caption }}>
            From {habits.count} titles you watched and rated.
          </Text>
        </Col>
        <Col xs={24} sm={10}>
          <Text style={{ color: token.colorTextSecondary }}>
            Contrarian score
            <InfoTooltip title="How far your ratings are from TMDB's, on average (TMDB scores as of when you added each title)." />
          </Text>
          <div className="accent-figure" style={{ fontSize: FONT_SIZE.display, lineHeight: 1.2 }}>
            {oneDecimal(habits.contrarianScore)}
          </div>
        </Col>
      </Row>
      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <TakeList heading="Guilty pleasures" items={habits.guiltyPleasures}
            empty="None yet: nothing you rated 1.5 or more above TMDB." />
        </Col>
        <Col xs={24} md={12}>
          <TakeList heading="Not for you" items={habits.notForYou}
            empty="None yet: nothing you rated 1.5 or more below TMDB." />
        </Col>
      </Row>
    </div>
  );
}
