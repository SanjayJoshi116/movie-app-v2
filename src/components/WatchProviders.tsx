import { Typography, Space } from "antd";
import type { TMDBProvider, TMDBProviderRegion } from "../types";
import { PROVIDER_SEARCH_URLS } from "../constants/providers";
import { LOGO_URL } from "../constants/ui";

interface WatchProvidersProps {
  providers: Record<string, TMDBProviderRegion>;
  title: string;
}

export function WatchProviders({ providers, title }: WatchProvidersProps) {
  const us = providers["US"];
  if (!us) return <Typography.Text type="secondary">No watch provider info available for your region.</Typography.Text>;

  const getProviderUrl = (p: TMDBProvider) =>
    PROVIDER_SEARCH_URLS[p.provider_id]?.(title) ?? us.link ?? "#";

  const renderSection = (sectionTitle: string, list: TMDBProvider[]) => (
    <div key={sectionTitle} style={{ marginBottom: 12 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>{sectionTitle}</Typography.Text>
      <Space wrap>
        {list.map((p) => (
          <a
            key={p.provider_id}
            href={getProviderUrl(p)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Watch on ${p.provider_name}`}
          >
            <img
              src={`${LOGO_URL}${p.logo_path}`}
              alt={p.provider_name}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", display: "block" }}
            />
          </a>
        ))}
      </Space>
    </div>
  );

  return (
    <>
      {us.flatrate && renderSection("Streaming", us.flatrate)}
      {us.rent && renderSection("Rent", us.rent)}
    </>
  );
}
