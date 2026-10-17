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
  LogoutOutlined,
  BarChartOutlined,
  UserAddOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useAppContext } from "../context/useAppContext";
import { useAuth } from "../context/AuthContext";
import SearchBox from "./SearchBox";
import ProfileModal from "./ProfileModal";
import NotificationBell from "./NotificationBell";
import { Wordmark } from "./Wordmark";
import { FONT_SIZE } from "../constants/typography";
import { resolveAvatarUrl } from "../constants/media";
import { useFlashTooltip } from "../hooks/useFlashTooltip";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { avatarColor } from "../utils/colors";
import { getInitials } from "../utils/initials";
import { navSection } from "../utils/navSection";
import { RATING_GOLD, WATCHED_GREEN, AVATAR_INITIALS_TEXT } from "../constants/ui";

interface Props {
  isBrowsePage: boolean;
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
}

const Sidebar = ({ isBrowsePage, showFilterPanel, onToggleFilterPanel }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, watchlist, watchedList } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [flashKey, triggerFlash] = useFlashTooltip();
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("cinedb_sidebar_collapsed", false);

  const navDefs = [
    { key: "/movies", icon: <VideoCameraOutlined />, label: "Movies" },
    { key: "/tv", icon: <PlaySquareOutlined />, label: "TV Shows" },
    { key: "/anime", icon: <FireOutlined />, label: "Anime" },
    { key: "/people", icon: <UserOutlined />, label: "People" },
    {
      key: "/watchlist",
      icon: (
        <Badge count={watchlist.length} size="small" color={RATING_GOLD}>
          <BookOutlined />
        </Badge>
      ),
      label: "Watchlist",
    },
    {
      key: "/watched",
      icon: (
        <Badge count={watchedList.length} size="small" color={WATCHED_GREEN} overflowCount={Infinity}>
          <EyeOutlined />
        </Badge>
      ),
      label: "Watched",
    },
    { key: "/recommendations", icon: <BulbOutlined />, label: "For You" },
    { key: "/calendar", icon: <CalendarOutlined />, label: "Calendar" },
    { key: "/lists", icon: <UnorderedListOutlined />, label: "My Lists" },
    { key: "/stats", icon: <BarChartOutlined />, label: "Stats" },
    { key: "/following", icon: <UserAddOutlined />, label: "Following" },
  ];

  // Each entry's text is a real link (Ctrl/middle-click opens a new tab).
  const menuItems: MenuProps["items"] = navDefs.map(({ key, label, icon }) => ({
    key,
    label: <Link to={key}>{label}</Link>,
    icon: (
      <Tooltip title={label} placement="right" open={flashKey === key || undefined}>
        {/* Also a link (out of the tab order: the label is the focusable one),
            so the icon-only rail opens a new tab on Ctrl/middle-click too. */}
        <Link to={key} tabIndex={-1} aria-hidden="true" className="sidebar-nav-icon-target">{icon}</Link>
      </Tooltip>
    ),
  }));

  return (
    <motion.aside
      className={`app-sidebar glass-sidebar${collapsed ? " sidebar-collapsed" : ""}`}
      initial={{ x: -220 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 12px" }}>
        <Link to="/movies" style={{ textDecoration: "none" }}>
          <Wordmark level={3} className="sidebar-logo-full sidebar-wordmark" />
          <Typography.Title
            level={3}
            className="sidebar-logo-compact"
            style={{ margin: 0, fontWeight: 700, textAlign: "center" }}
          >
            C
          </Typography.Title>
        </Link>
      </div>

      {/* Search */}
      <div className="sidebar-search-full" style={{ padding: "0 12px 8px", position: "relative" }}>
        <SearchBox />
      </div>

      {/* Navigation Menu */}
      <Menu
        mode="inline"
        selectedKeys={[navSection(location.pathname, navDefs.map((d) => d.key)) ?? ""]}
        onClick={({ key, domEvent }) => {
          triggerFlash(String(key));
          // The link handles clicks on the label (one history entry); the
          // icon and padding around it navigate here.
          if (!(domEvent.target as HTMLElement).closest("a")) navigate(String(key));
        }}
        items={menuItems}
        style={{ border: "none", background: "transparent", flex: 1 }}
      />

      <div style={{ flexGrow: 1 }} />

      <Divider style={{ margin: "4px 0" }} />

      {/* Footer: filter + theme + auth */}
      <div className="sidebar-footer">
        {isBrowsePage && (
          <Button
            icon={<FilterOutlined />}
            type={showFilterPanel ? "primary" : "default"}
            onClick={onToggleFilterPanel}
            block
            aria-label="Toggle filters"
            aria-expanded={showFilterPanel}
          >
            <span className="sidebar-label">Filters</span>
          </Button>
        )}
        <div className="sidebar-footer-icons">
          {isAuthenticated && <NotificationBell placement="topLeft" autoAdjustOverflow={false} />}
          <Tooltip title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <Button
              type="text"
              icon={theme === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              style={{ color: RATING_GOLD, padding: "0 4px" }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            />
          </Tooltip>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Button
              className="sidebar-collapse-toggle"
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((c) => !c)}
              style={{ padding: "0 4px" }}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            />
          </Tooltip>
        </div>

        <Divider style={{ margin: "2px 0" }} />

        {/* App.tsx renders the Sidebar only when signed in, so there is no signed-out branch. */}
        {isAuthenticated && user && (
          <div className="sidebar-user-row" style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4 }}>
            <Tooltip title="Edit Profile">
              {/* A real button, so the profile dialog (password, email, account
                  delete) is reachable from the keyboard on desktop too. */}
              <button
                type="button"
                className="sidebar-avatar-btn"
                aria-label="Edit profile"
                onClick={() => setProfileOpen(true)}
              >
                <Avatar
                  size={36}
                  src={resolveAvatarUrl(user.avatar_url)}
                  style={{
                    backgroundColor: user.avatar_url ? undefined : avatarColor(user.username),
                    color: AVATAR_INITIALS_TEXT,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {!user.avatar_url && getInitials(user)}
                </Avatar>
              </button>
            </Tooltip>
            <Typography.Text className="sidebar-username-text" style={{ flex: 1, minWidth: 0, fontSize: FONT_SIZE.body, fontWeight: 600 }} ellipsis>
              {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}
            </Typography.Text>
            <Tooltip title="Sign Out">
              <Button
                type="text"
                icon={<LogoutOutlined />}
                size="small"
                aria-label="Sign out"
                onClick={() => {
                  logout();
                  navigate("/movies");
                }}
              />
            </Tooltip>
            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
