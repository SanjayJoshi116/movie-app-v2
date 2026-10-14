import { useState } from "react";
import { Input, Dropdown, Typography } from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import { useRecentSearches } from "../hooks/useRecentSearches";
import { FONT_SIZE } from "../constants/typography";

const CLEAR_KEY = "__clear__";

type MenuItem = Required<MenuProps>["items"][number];

interface Props {
  /** The input's id. Each mounted search box needs its own (the sidebar's and the phone drawer's can both be in the page). */
  id?: string;
}

const SearchBox = ({ id = "global-search" }: Props) => {
  const { setSearchTerm, searchTerm } = useAppContext();
  const [inputValue, setInputValue] = useState(searchTerm);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Show the term in effect whenever it changes from outside the typing
  // (a ?q= address, a picked recent search, a reset on sign-out). Done during
  // render, so the box never shows the old term for a frame.
  const [shownTerm, setShownTerm] = useState(searchTerm);
  if (searchTerm !== shownTerm) {
    setShownTerm(searchTerm);
    setInputValue(searchTerm);
  }
  const { recents, addRecent, clearRecents } = useRecentSearches();
  const navigate = useNavigate();
  const location = useLocation();

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
    // Term in the URL (reloadable, shareable); keep the current tab when re-searching.
    const params = new URLSearchParams({ q: trimmed });
    const tab = location.pathname === "/search" ? new URLSearchParams(location.search).get("tab") : null;
    if (tab) params.set("tab", tab);
    navigate(`/search?${params}`);
  };

  const recentItems: MenuItem[] = recents.map((r) => ({ key: r, label: r }));

  const divider: MenuItem = { type: "divider" };

  const clearItem: MenuItem = {
    key: CLEAR_KEY,
    label: (
      <Typography.Text type="danger" style={{ fontSize: FONT_SIZE.body }}>
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
      getPopupContainer={(triggerNode) => (triggerNode.parentElement as HTMLElement) ?? document.body}
    >
      <Input.Search
        id={id}
        name="search"
        autoComplete="off"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (e.target.value === "") setSearchTerm("");
        }}
        onSearch={handleSearch}
        onFocus={() => setDropdownOpen(true)}
        placeholder="Search movies, shows or people…"
        allowClear
        size="large"
        aria-label="Search for movies or shows"
        style={{ width: "100%" }}
      />
    </Dropdown>
    </>
  );
};

export default SearchBox;
