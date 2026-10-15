import { useEffect, useMemo, useState } from "react";
import { Form, Select } from "antd";
import { fetchProviderRegions } from "../api/tmdb";
import { useUIContext } from "../context/UIContext";
import { regionName } from "../utils/region";

/**
 * The region where-to-watch data is shown for (title-details spec). A device
 * preference like the theme: saved at once, kept across sign-out. Options are
 * TMDB's watch-provider regions; if those can't load, the current one stays.
 */
export function RegionSelect() {
  const { region, setRegion } = useUIContext();
  const [regions, setRegions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    fetchProviderRegions()
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data?.results)) return;
        setRegions(
          data.results
            .filter((r) => typeof r?.iso_3166_1 === "string")
            .map((r) => ({ value: r.iso_3166_1, label: r.english_name || regionName(r.iso_3166_1) }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(
    () => (regions.some((r) => r.value === region) ? regions : [{ value: region, label: regionName(region) }, ...regions]),
    [regions, region],
  );

  return (
    <Form.Item
      label="Region"
      htmlFor="profile-region"
      extra="Where to Watch, certifications and platform choices use this region."
      style={{ marginBottom: 16 }}
    >
      <Select
        id="profile-region"
        showSearch
        optionFilterProp="label"
        value={region}
        onChange={setRegion}
        options={options}
        style={{ width: "100%", maxWidth: 320 }}
      />
    </Form.Item>
  );
}
