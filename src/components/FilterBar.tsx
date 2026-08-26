import type { ReactNode } from "react";
import { Input, Select, Button, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { LibraryTypeFilter } from "../hooks/useLibraryFilters";

interface SortConfig<TSort extends string> {
  value: TSort;
  onChange: (value: TSort) => void;
  options: { label: string; value: TSort }[];
  maxWidth?: number;
}

interface TypeFilterConfig {
  value: LibraryTypeFilter;
  onChange: (value: LibraryTypeFilter) => void;
}

interface Props<TSort extends string> {
  search: { value: string; onChange: (value: string) => void; id: string; placeholder: string };
  sort?: SortConfig<TSort>;
  typeFilter?: TypeFilterConfig;
  extra?: ReactNode;
  showClear: boolean;
  onClear: () => void;
}

function FilterBar<TSort extends string>({ search, sort, typeFilter, extra, showClear, onClear }: Props<TSort>) {
  return (
    <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
      <Input
        id={search.id}
        name="search"
        autoComplete="off"
        prefix={<SearchOutlined />}
        placeholder={search.placeholder}
        value={search.value}
        onChange={(e) => search.onChange(e.target.value)}
        allowClear
        style={{ width: "100%", maxWidth: 200 }}
      />
      {sort && (
        <Select
          value={sort.value}
          onChange={sort.onChange}
          style={{ width: "100%", maxWidth: sort.maxWidth ?? 170 }}
          options={sort.options}
        />
      )}
      {typeFilter && (
        <Select
          value={typeFilter.value}
          onChange={typeFilter.onChange}
          style={{ width: "100%", maxWidth: 130 }}
          options={[
            { label: "All Types", value: "all" },
            { label: "Movies", value: "movie" },
            { label: "TV Shows", value: "tv" },
          ]}
        />
      )}
      {extra}
      {showClear && (
        <Button type="text" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </Space>
  );
}

export default FilterBar;
