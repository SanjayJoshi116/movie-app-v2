import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { MenuProps } from "antd";
import { Menu, Badge, Switch, Button, Typography, Divider } from "antd";
import {
  VideoCameraOutlined,
  PlaySquareOutlined,
  BookOutlined,
  UserOutlined,
  FilterOutlined,
  SunOutlined,
  MoonOutlined,
  BulbOutlined,
  EyeOutlined,
  FireOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useAppContext } from "../context/useAppContext";
import SearchBox from "./SearchBox";

interface Props {
  isBrowsePage: boolean;
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
}

const Sidebar = ({ isBrowsePage, showFilterPanel, onToggleFilterPanel }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, watchlist, watchedList } = useAppContext();

  const menuItems: MenuProps["items"] = [
    {
      key: "/movies",
      icon: <VideoCameraOutlined />,
      label: "Movies",
    },
    {
      key: "/tv",
      icon: <PlaySquareOutlined />,
      label: "TV Shows",
    },
    {
      key: "/anime",
      icon: <FireOutlined />,
      label: "Anime",
    },
    {
      key: "/people",
      icon: <UserOutlined />,
      label: "People",
    },
    {
      key: "/watchlist",
      icon: (
        <Badge count={watchlist.length} size="small" color="#f5c518">
          <BookOutlined />
        </Badge>
      ),
      label: "Watchlist",
    },
    {
      key: "/watched",
      icon: (
        <Badge count={watchedList.length} size="small" color="#52c41a">
          <EyeOutlined />
        </Badge>
      ),
      label: "Watched",
    },
    {
      key: "/recommendations",
      icon: <BulbOutlined />,
      label: "For You",
    },
  ];

  return (
    <motion.aside
      className="app-sidebar glass-sidebar"
      initial={{ x: -220 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 20px" }}>
        <Link to="/movies" style={{ textDecoration: "none" }}>
          <Typography.Title
            level={3}
            style={{ margin: 0, color: "#f5c518", letterSpacing: 3, fontWeight: 700 }}
          >
            CINE DB
          </Typography.Title>
        </Link>
      </div>

      {/* Search */}
      <div style={{ padding: "0 12px 12px" }}>
        <SearchBox />
      </div>

      {/* Navigation Menu */}
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        onSelect={({ key }) => navigate(key)}
        items={menuItems}
        style={{ border: "none", background: "transparent", flex: 1 }}
      />

      <div style={{ flexGrow: 1 }} />

      <Divider style={{ margin: "8px 0" }} />

      {/* Footer: filter + theme */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {isBrowsePage && (
          <Button
            icon={<FilterOutlined />}
            type={showFilterPanel ? "primary" : "default"}
            onClick={onToggleFilterPanel}
            block
            aria-label="Toggle filters"
            aria-expanded={showFilterPanel}
          >
            Filters
          </Button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
          <Switch
            checkedChildren={<SunOutlined />}
            unCheckedChildren={<MoonOutlined />}
            checked={theme === "light"}
            onChange={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {theme === "dark" ? "Dark mode" : "Light mode"}
          </Typography.Text>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
