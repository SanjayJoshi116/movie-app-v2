import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Layout,
  Input,
  Button,
  Badge,
  Switch,
  Space,
  Typography,
} from "antd";
import {
  FilterOutlined,
  SunOutlined,
  MoonOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";

const { Header: AntHeader } = Layout;

interface Props {
  showFilterPanel?: boolean;
  onToggleFilterPanel?: () => void;
}

const Header = ({ showFilterPanel, onToggleFilterPanel }: Props) => {
  const { setSearchTerm, theme, toggleTheme, watchlist } = useAppContext();
  const [search, setSearch] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const isMovieTab = location.pathname === "/movies" || location.pathname === "/";
  const isTVTab = location.pathname === "/tv";

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setSearch("");
  };

  return (
    <AntHeader
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 64,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Logo */}
      <Link to="/movies" style={{ textDecoration: "none", flexShrink: 0 }}>
        <Typography.Title
          level={3}
          style={{
            margin: 0,
            color: "#f5c518",
            letterSpacing: 3,
            fontWeight: 700,
            lineHeight: "64px",
          }}
        >
          CINE DB
        </Typography.Title>
      </Link>

      {/* Center nav + search */}
      <Space size={8} style={{ flex: 1, justifyContent: "center", marginLeft: 24 }}>
        <Button
          type={isMovieTab ? "primary" : "text"}
          onClick={() => navigate("/movies")}
          aria-current={isMovieTab ? "page" : undefined}
          style={{ fontWeight: isMovieTab ? 600 : 400 }}
        >
          Movies
        </Button>
        <Button
          type={isTVTab ? "primary" : "text"}
          onClick={() => navigate("/tv")}
          aria-current={isTVTab ? "page" : undefined}
          style={{ fontWeight: isTVTab ? 600 : 400 }}
        >
          TV Shows
        </Button>

        <Input.Search
          placeholder="Search movies or shows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={handleSearch}
          allowClear
          style={{ width: 280 }}
          aria-label="Search for movies or shows"
        />
      </Space>

      {/* Right actions */}
      <Space size={12} style={{ flexShrink: 0, marginLeft: 16 }}>
        {onToggleFilterPanel && (
          <Button
            icon={<FilterOutlined />}
            type={showFilterPanel ? "primary" : "default"}
            onClick={onToggleFilterPanel}
            aria-label="Toggle filters"
            aria-expanded={showFilterPanel}
          >
            Filters
          </Button>
        )}

        <Link to="/watchlist" aria-label="Watchlist">
          <Badge count={watchlist.length} size="small" color="#f5c518">
            <Button icon={<BookOutlined />} type="text" style={{ color: "inherit" }} />
          </Badge>
        </Link>

        <Switch
          checkedChildren={<SunOutlined />}
          unCheckedChildren={<MoonOutlined />}
          checked={theme === "light"}
          onChange={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        />
      </Space>
    </AntHeader>
  );
};

export default Header;
