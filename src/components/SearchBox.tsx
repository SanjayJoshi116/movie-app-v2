import React, { useState } from "react";
import { Input, Dropdown, Typography, Switch } from "antd";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import { useRecentSearches } from "../hooks/useRecentSearches";

const CLEAR_KEY = "__clear__";

type MenuItem = Required<MenuProps>["items"][number];

const SearchBox = () => {
  const [inputValue, setInputValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { setSearchTerm, searchTerm, includeAdult, setIncludeAdult } = useAppContext();
  const { recents, addRecent, clearRecents } = useRecentSearches();
  const navigate = useNavigate();

  const handleSearch = (value: string) => {
    if (value === CLEAR_KEY) {
      clearRecents();
      setDropdownOpen(false);
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setSearchTerm("");
      return;
    }
    setSearchTerm(trimmed);
    addRecent(trimmed);
    setDropdownOpen(false);
    navigate("/search");
  };

  const recentItems: MenuItem[] = recents.map((r) => ({ key: r, label: r }));

  const divider: MenuItem = { type: "divider" };

  const clearItem: MenuItem = {
    key: CLEAR_KEY,
    label: (
      <Typography.Text type="danger" style={{ fontSize: 12 }}>
        Clear recent searches
      </Typography.Text>
    ),
  };

  const menuItems: MenuProps["items"] =
    recents.length > 0 ? [...recentItems, divider, clearItem] : [];

  const showDropdown = dropdownOpen && recents.length > 0 && (inputValue === "" || inputValue === searchTerm);

  return (
    <>
    <Dropdown
      open={showDropdown}
      onOpenChange={(visible) => {
        if (!visible) setDropdownOpen(false);
      }}
      menu={{
        items: menuItems,
        onClick: ({ key }) => handleSearch(key),
      }}
      trigger={[]}
    >
      <Input.Search
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (e.target.value === "") setSearchTerm("");
        }}
        onSearch={handleSearch}
        onFocus={() => setDropdownOpen(true)}
        placeholder="Search movies, shows or people…"
        allowClear
        aria-label="Search for movies or shows"
        style={{ width: "100%" }}
      />
    </Dropdown>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingLeft: 4 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Adult content</Typography.Text>
      <Switch size="small" checked={includeAdult} onChange={setIncludeAdult} />
    </div>
    </>
  );
};

export default SearchBox;
