import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { MenuProps } from "antd";
import { Menu, Badge, Button, Typography, Divider, Avatar, Tooltip } from "antd";
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
  CalendarOutlined,
  UnorderedListOutlined,
  LoginOutlined,
  LogoutOutlined,
  BarChartOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useAppContext } from "../context/useAppContext";
import { useAuth } from "../context/AuthContext";
import SearchBox from "./SearchBox";
import ProfileModal from "./ProfileModal";
import { FONT_SIZE } from "../constants/typography";
import { resolveAvatarUrl } from "../constants/media";

interface Props {
  isBrowsePage: boolean;
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
}

function getInitials(user: { first_name?: string; last_name?: string; username: string }): string {
  const f = user.first_name?.trim() ?? "";
  const l = user.last_name?.trim() ?? "";
  if (f && l) return (f[0]! + l[0]!).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return user.username.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#e67e22", "#8e44ad", "#2980b9", "#27ae60", "#c0392b", "#16a085"];
function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? "#e67e22";
}

const Sidebar = ({ isBrowsePage, showFilterPanel, onToggleFilterPanel }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, watchlist, watchedList } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

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
        <Badge count={watchedList.length} size="small" color="#52c41a" overflowCount={Infinity}>
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
    {
      key: "/calendar",
      icon: <CalendarOutlined />,
      label: "Calendar",
    },
    {
      key: "/lists",
      icon: <UnorderedListOutlined />,
      label: "My Lists",
    },
    {
      key: "/stats",
      icon: <BarChartOutlined />,
      label: "Stats",
    },
    {
      key: "/following",
      icon: <UserAddOutlined />,
      label: "Following",
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

      {/* Footer: filter + theme + auth */}
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
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Tooltip title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <Button
              type="text"
              icon={theme === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              style={{ color: "#f5c518", padding: "0 4px" }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            />
          </Tooltip>
        </div>

        <Divider style={{ margin: "4px 0" }} />

        {isAuthenticated && user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4 }}>
            <Tooltip title="Edit Profile">
              <Avatar
                size={36}
                src={resolveAvatarUrl(user.avatar_url)}
                style={{
                  backgroundColor: user.avatar_url ? undefined : avatarColor(user.username),
                  color: "#fff",
                  fontWeight: 700,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
                onClick={() => setProfileOpen(true)}
              >
                {!user.avatar_url && getInitials(user)}
              </Avatar>
            </Tooltip>
            <Typography.Text style={{ flex: 1, minWidth: 0, fontSize: FONT_SIZE.body, fontWeight: 600 }} ellipsis>
              {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}
            </Typography.Text>
            <Tooltip title="Sign Out">
              <Button
                type="text"
                icon={<LogoutOutlined />}
                size="small"
                onClick={() => {
                  logout();
                  navigate("/movies");
                }}
              />
            </Tooltip>
            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
          </div>
        ) : (
          <Button
            icon={<LoginOutlined />}
            type="default"
            block
            onClick={() => navigate("/login")}
          >
            Sign In
          </Button>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
