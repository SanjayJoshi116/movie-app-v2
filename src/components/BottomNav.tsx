import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Drawer, Divider } from "antd";
import {
  VideoCameraOutlined,
  PlaySquareOutlined,
  BookOutlined,
  EyeOutlined,
  EllipsisOutlined,
  FireOutlined,
  UserOutlined,
  BulbOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  LoginOutlined,
  LogoutOutlined,
  SearchOutlined,
  RightOutlined,
  BarChartOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useAuth } from "../context/AuthContext";
import SearchBox from "./SearchBox";
import ProfileModal from "./ProfileModal";
import { FONT_SIZE } from "../constants/typography";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { watchlist, watchedList } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  const coreItems = [
    { path: "/movies", icon: <VideoCameraOutlined />, label: "Movies" },
    { path: "/tv", icon: <PlaySquareOutlined />, label: "TV" },
    { path: "/watchlist", icon: <BookOutlined />, label: "Watchlist", badge: watchlist.length },
  ];

  const moreItems = [
    { path: "/watched", icon: <EyeOutlined />, label: "Watched", badge: watchedList.length },
    { path: "/anime", icon: <FireOutlined />, label: "Anime" },
    { path: "/people", icon: <UserOutlined />, label: "People" },
    { path: "/recommendations", icon: <BulbOutlined />, label: "For You" },
    { path: "/calendar", icon: <CalendarOutlined />, label: "Calendar" },
    { path: "/lists", icon: <UnorderedListOutlined />, label: "My Lists" },
    { path: "/stats", icon: <BarChartOutlined />, label: "Stats" },
    { path: "/following", icon: <UserAddOutlined />, label: "Following" },
  ];

  const handleMoreNav = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  const isMoreActive = moreItems.some((item) => location.pathname === item.path);

  return (
    <>
      <nav className="app-bottom-nav" aria-label="Mobile navigation">
        {coreItems.map((item) => {
          const isActive = location.pathname === item.path;
          const btn = (
            <Button
              key={item.path}
              type="text"
              icon={item.icon}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "auto",
                padding: "4px 12px",
                color: isActive ? "#f5c518" : undefined,
              }}
            />
          );

          return item.badge != null && item.badge > 0 ? (
            <Badge key={item.path} count={item.badge} size="small" color="#f5c518" offset={[4, 0]} overflowCount={Infinity}>
              {btn}
            </Badge>
          ) : (
            btn
          );
        })}

        <Button
          type="text"
          icon={<SearchOutlined />}
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "auto",
            padding: "4px 12px",
          }}
        />

        <Button
          type="text"
          icon={<EllipsisOutlined />}
          onClick={() => setMoreOpen(true)}
          aria-label="More navigation options"
          aria-expanded={moreOpen}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "auto",
            padding: "4px 12px",
            color: isMoreActive ? "#f5c518" : undefined,
          }}
        />
      </nav>

      <Drawer
        title="Search"
        placement="bottom"
        height="auto"
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        styles={{ body: { padding: "16px" } }}
      >
        <SearchBox />
      </Drawer>

      <Drawer
        title="More"
        placement="bottom"
        height="auto"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        styles={{ body: { padding: "8px 0 16px" } }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "4px 8px" }}>
          {moreItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleMoreNav(item.path)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: 72,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isActive ? "#f5c518" : "inherit",
                  fontWeight: isActive ? 600 : undefined,
                  borderRadius: 8,
                  position: "relative",
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: FONT_SIZE.caption }}>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    position: "absolute",
                    top: 10,
                    right: "calc(50% - 22px)",
                    background: "#f5c518",
                    color: "#000",
                    borderRadius: 10,
                    padding: "0 5px",
                    fontSize: FONT_SIZE.caption,
                    fontWeight: 700,
                    minWidth: 16,
                    textAlign: "center",
                    lineHeight: "16px",
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Divider style={{ margin: "4px 0" }} />

        {isAuthenticated ? (
          <>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: 48,
                padding: "0 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "inherit",
              }}
              onClick={() => {
                setMoreOpen(false);
                setProfileOpen(true);
              }}
            >
              <span style={{ fontSize: 16, width: 20, display: "flex", justifyContent: "center" }}>
                <UserOutlined />
              </span>
              <span style={{ marginLeft: 12, flex: 1, textAlign: "left", fontSize: FONT_SIZE.body }}>
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username}
              </span>
              <RightOutlined style={{ fontSize: 12, opacity: 0.4 }} />
            </button>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: 44,
                padding: "0 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "inherit",
              }}
              onClick={() => {
                setMoreOpen(false);
                logout();
                navigate("/movies");
              }}
            >
              <span style={{ fontSize: 16, width: 20, display: "flex", justifyContent: "center" }}>
                <LogoutOutlined />
              </span>
              <span style={{ marginLeft: 12, fontSize: FONT_SIZE.body }}>Sign Out</span>
            </button>
          </>
        ) : (
          <button
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              height: 44,
              padding: "0 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
            }}
            onClick={() => handleMoreNav("/login")}
          >
            <span style={{ fontSize: 16, width: 20, display: "flex", justifyContent: "center" }}>
              <LoginOutlined />
            </span>
            <span style={{ marginLeft: 12, fontSize: FONT_SIZE.body }}>Sign In</span>
          </button>
        )}
      </Drawer>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
};

export default BottomNav;
