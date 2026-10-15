import { Typography, Space } from "antd";
import type { TMDBProvider, TMDBProviderRegion } from "../types";
import { PROVIDER_SEARCH_URLS } from "../constants/providers";
import { LOGO_URL } from "../constants/ui";
import { safeHttpUrl } from "../utils/safeUrl";
import { pickRegion, regionName } from "../utils/region";
import { useRegion } from "../hooks/useRegion";

interface WatchProvidersProps {
  providers: Record<string, TMDBProviderRegion>;
  title: string;
}

export function WatchProviders({ providers, title }: WatchProvidersProps) {
  const region = useRegion();
  // The user's region, else the US (labelled); messages name the region.
  const picked = pickRegion(providers, region);
  const shown = picked.data;
  const sections = shown
    ? ([["Streaming", shown.flatrate], ["Rent", shown.rent], ["Buy", shown.buy]] as Array<[string, TMDBProvider[] | undefined]>)
        .filter((entry): entry is [string, TMDBProvider[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    : [];
  if (!shown || sections.length === 0) {
    return (
      <Typography.Text type="secondary">
        Not available to stream, rent or buy in your region ({regionName(region)}).
      </Typography.Text>
    );
  }

  // TMDB's `link` is third-party data: a link only with a web scheme.
  const getProviderUrl = (p: TMDBProvider): string | null =>
    PROVIDER_SEARCH_URLS[p.provider_id]?.(title) ?? safeHttpUrl(shown.link);

  const renderSection = (sectionTitle: string, list: TMDBProvider[]) => (
    <div key={sectionTitle} style={{ marginBottom: 12 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>{sectionTitle}</Typography.Text>
      <Space wrap>
        {list.map((p) => {
          const logo = (
            <img
              src={`${LOGO_URL}${p.logo_path}`}
              alt={p.provider_name}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", display: "block" }}
            />
          );
          const href = getProviderUrl(p);
          return href ? (
            <a key={p.provider_id} href={href} target="_blank" rel="noopener noreferrer" title={`Watch on ${p.provider_name}`}>
              {logo}
            </a>
          ) : (
            <span key={p.provider_id} title={p.provider_name}>{logo}</span>
          );
        })}
      </Space>
    </div>
  );

  return (
    <>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        {picked.fallback
          ? `Showing United States availability: nothing listed for ${regionName(region)}.`
          : `Region: ${regionName(picked.code)}`}
      </Typography.Text>
      {sections.map(([sectionTitle, list]) => renderSection(sectionTitle, list))}
    </>
  );
}
