import { useState } from "react";
import { theme } from "antd";
import { PlayCircleFilled } from "@ant-design/icons";
import { YT_THUMB_URL } from "../constants/ui";

interface TrailerEmbedProps {
  videoKey: string;
  name: string;
}

/**
 * A trailer that loads the YouTube player only when asked: a thumbnail button
 * first, then the embed (autoplaying) once activated. Each player is ~1 MB of
 * script plus its own main-thread work, so a page with several trailers no
 * longer pays for all of them up front.
 */
export function TrailerEmbed({ videoKey, name }: TrailerEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const { token } = theme.useToken();

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1`}
        title={name}
        className="embed-frame"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        // Explicit: after an in-app navigation from a no-referrer page (reset
        // link, TMDB callback) the document keeps nginx's no-referrer policy,
        // and YouTube refuses to play an embed with no Referer (Error 153).
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  return (
    <button
      type="button"
      className="embed-frame trailer-facade"
      aria-label={`Play trailer: ${name}`}
      onClick={() => setPlaying(true)}
      style={{ background: token.colorFillTertiary }}
    >
      <img src={YT_THUMB_URL(videoKey)} alt="" loading="lazy" className="trailer-facade-img" />
      <PlayCircleFilled className="trailer-facade-icon" style={{ fontSize: 64, color: token.colorWhite }} />
    </button>
  );
}
