import { useState } from "react";
import {
  Drawer,
  Form,
  InputNumber,
  Select,
  Button,
  Space,
  Typography,
  Divider,
  Tag,
  Switch,
} from "antd";
import type { FilterValues, SortOption } from "../../types";
import { useAppContext } from "../../context/useAppContext";
import { genres } from "../../constants/genres";
import { FONT_SIZE } from "../../constants/typography";

const { CheckableTag } = Tag;

interface Language {
  code: string;
  name: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "hi", name: "Hindi" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "popularity.desc", label: "Popularity" },
  { value: "vote_average.desc", label: "Rating (High to Low)" },
  { value: "primary_release_date.desc", label: "Release Date (Newest)" },
  { value: "primary_release_date.asc", label: "Release Date (Oldest)" },
  { value: "original_title.asc", label: "Title (A–Z)" },
];

const DEFAULT_FILTERS: FilterValues = {
  yearFrom: "",
  yearTo: "",
  minRating: "",
  maxRating: "",
  language: "",
  minRuntime: "",
  maxRuntime: "",
  includeAdult: false,
};

interface Props {
  open: boolean;
  onClose: () => void;
  isMovie: boolean;
  onApply: (filters: FilterValues, sortBy: SortOption) => void;
  onReset: () => void;
}

export function FilterPanel({ open, onClose, isMovie, onApply, onReset }: Props) {
  const { selectedGenres, toggleGenre, clearGenres } = useAppContext();
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>("popularity.desc");

  const set = (key: keyof FilterValues, val: string) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const handleApply = () => {
    onApply(filters, sortBy);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setSortBy("popularity.desc");
    clearGenres();
    onReset();
  };

  return (
    <Drawer
      title="Filter & Sort"
      placement="right"
      open={open}
      onClose={onClose}
      width={320}
      footer={
        <Space style={{ justifyContent: "flex-end", width: "100%" }}>
          <Button onClick={handleReset}>Reset</Button>
          <Button type="primary" onClick={handleApply}>
            Apply Filters
          </Button>
        </Space>
      }
    >
      <Form layout="vertical" size="middle">
        <Typography.Text strong>Year Range</Typography.Text>
        <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
          <Form.Item label="From" style={{ flex: 1, marginBottom: 0 }}>
            <InputNumber
              min={1900}
              max={2030}
              placeholder="e.g. 2010"
              value={filters.yearFrom ? Number(filters.yearFrom) : undefined}
              onChange={(v) => set("yearFrom", v?.toString() ?? "")}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="To" style={{ flex: 1, marginBottom: 0 }}>
            <InputNumber
              min={1900}
              max={2030}
              placeholder="e.g. 2024"
              value={filters.yearTo ? Number(filters.yearTo) : undefined}
              onChange={(v) => set("yearTo", v?.toString() ?? "")}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </div>

        <Divider style={{ margin: "8px 0 16px" }} />

        <Form.Item label="Min TMDB Rating (0–10)" style={{ marginBottom: 16 }}>
          <InputNumber
            min={0}
            max={10}
            step={0.5}
            placeholder="e.g. 7"
            value={filters.minRating ? Number(filters.minRating) : undefined}
            onChange={(v) => set("minRating", v?.toString() ?? "")}
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label="Language" style={{ marginBottom: 16 }}>
          <Select
            placeholder="Any language"
            allowClear
            value={filters.language || undefined}
            onChange={(v) => set("language", v ?? "")}
            options={[
              { value: "", label: "Any" },
              ...LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
            ]}
          />
        </Form.Item>

        {isMovie && (
          <>
            <Divider style={{ margin: "8px 0 16px" }} />
            <Typography.Text strong>Runtime (minutes)</Typography.Text>
            <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
              <Form.Item label="Min" style={{ flex: 1, marginBottom: 0 }}>
                <InputNumber
                  min={0}
                  placeholder="e.g. 60"
                  value={filters.minRuntime ? Number(filters.minRuntime) : undefined}
                  onChange={(v) => set("minRuntime", v?.toString() ?? "")}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="Max" style={{ flex: 1, marginBottom: 0 }}>
                <InputNumber
                  min={0}
                  placeholder="e.g. 180"
                  value={filters.maxRuntime ? Number(filters.maxRuntime) : undefined}
                  onChange={(v) => set("maxRuntime", v?.toString() ?? "")}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </div>
          </>
        )}

        <Divider style={{ margin: "8px 0 16px" }} />

        <Typography.Text strong>Genres</Typography.Text>
        <div
          role="group"
          aria-label="Genre filters"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 16 }}
        >
          {genres.map((genre) => {
            const selected = selectedGenres.includes(genre.id);
            return (
              <CheckableTag
                key={genre.id}
                checked={selected}
                onChange={() => toggleGenre(genre.id)}
                aria-pressed={selected}
                style={{
                  fontSize: FONT_SIZE.caption,
                  padding: "4px 12px",
                  borderRadius: 50,
                  border: selected ? "1px solid #f5c518" : "1px solid rgba(128,128,128,0.4)",
                  cursor: "pointer",
                }}
              >
                {genre.name}
              </CheckableTag>
            );
          })}
        </div>

        <Divider style={{ margin: "8px 0 16px" }} />

        <Form.Item label="Sort By" style={{ marginBottom: 16 }}>
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as SortOption)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Form.Item>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography.Text>Include Adult Content</Typography.Text>
          <Switch
            checked={filters.includeAdult}
            onChange={(v) => setFilters((prev) => ({ ...prev, includeAdult: v }))}
          />
        </div>
      </Form>
    </Drawer>
  );
}
