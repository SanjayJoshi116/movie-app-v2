import React from "react";
import { Space, Tooltip } from "antd";
import type { TMDBProviderRegion } from "../types";

interface Props {
  providers?: TMDBProviderRegion;
}

function StreamingBadges({ providers }: Props) {
  const flatrate = providers?.flatrate;
  if (!flatrate || flatrate.length === 0) return null;

  return (
    <Space size={4} wrap style={{ marginTop: 6 }}>
      {flatrate.slice(0, 3).map((p) => (
        <Tooltip key={p.provider_id} title={p.provider_name}>
          <img
            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
            alt={p.provider_name}
            style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }}
          />
        </Tooltip>
      ))}
    </Space>
  );
}

export default StreamingBadges;
