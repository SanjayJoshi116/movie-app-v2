import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, Drawer, Space, Divider, Typography } from "antd";
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
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useAuth } from "../context/AuthContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { watchlist, watchedList } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const coreItems = [
    { path: "/movies", icon: <VideoCameraOutlined />, label: "Movies" },
    { path: "/tv", icon: <PlaySquareOutlined />, label: "TV" },
    { path: "/watchlist", icon: <BookOutlined />, label: "Watchlist", badge: watchlist.length },
    { path: "/watched", icon: <EyeOutlined />, label: "Watched", badge: watchedList.length },
  ];

  const moreItems = [
    { path: "/anime", icon: <FireOutlined />, label: "Anime" },
    { path: "/people", icon: <UserOutlined />, label: "People" },
    { path: "/recommendations", icon: <BulbOutlined />, label: "For You" },
    { path: "/calendar", icon: <CalendarOutlined />, label: "Calendar" },
    { path: "/lists", icon: <UnorderedListOutlined />, label: "My Lists" },
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
            <Badge key={item.path} count={item.badge} size="small" color="#f5c518" offset={[4, 0]}>
              {btn}
            </Badge>
          ) : (
            btn
          );
        })}

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
        title="More"
        placement="bottom"
        height="auto"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        styles={{ body: { padding: "8px 0 16px" } }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={4}>
          {moreItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                type="text"
                icon={item.icon}
                block
                onClick={() => handleMoreNav(item.path)}
                style={{
                  textAlign: "left",
                  height: 44,
                  fontWeight: isActive ? 600 : undefined,
                  color: isActive ? "#f5c518" : undefined,
                }}
              >
                {item.label}
              </Button>
            );
          })}

          <Divider style={{ margin: "4px 0" }} />

          {isAuthenticated ? (
            <>
              <Typography.Text type="secondary" style={{ paddingLeft: 16, fontSize: 12 }}>
                Signed in as <strong>{user?.username}</strong>
              </Typography.Text>
              <Button
                type="text"
                icon={<LogoutOutlined />}
                block
                style={{ textAlign: "left", height: 44 }}
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                  navigate("/movies");
                }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <Button
              type="text"
              icon={<LoginOutlined />}
              block
              style={{ textAlign: "left", height: 44 }}
              onClick={() => handleMoreNav("/login")}
            >
              Sign In
            </Button>
          )}
        </Space>
      </Drawer>
    </>
  );
};

export default BottomNav;
