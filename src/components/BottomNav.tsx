import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button } from "antd";
import { VideoCameraOutlined, PlaySquareOutlined, BookOutlined, UserOutlined, BulbOutlined, EyeOutlined, FireOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { watchlist, watchedList } = useAppContext();

  const navItems = [
    { path: "/movies", icon: <VideoCameraOutlined />, label: "Movies" },
    { path: "/tv", icon: <PlaySquareOutlined />, label: "TV" },
    { path: "/anime", icon: <FireOutlined />, label: "Anime" },
    { path: "/people", icon: <UserOutlined />, label: "People" },
    { path: "/watchlist", icon: <BookOutlined />, label: "Watchlist", badge: watchlist.length },
    { path: "/watched", icon: <EyeOutlined />, label: "Watched", badge: watchedList.length },
    { path: "/recommendations", icon: <BulbOutlined />, label: "For You" },
  ];

  return (
    <nav className="app-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => {
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
    </nav>
  );
};

export default BottomNav;
