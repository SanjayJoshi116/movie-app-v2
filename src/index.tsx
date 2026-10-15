import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import { ListsProvider } from "./context/ListsContext";
import { FollowedPeopleProvider } from "./context/FollowedPeopleContext";
import { NotificationsProvider } from "./hooks/useNotifications";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import App from "./App";

// Prevent browser from auto-restoring scroll; our pages handle it explicitly
window.history.scrollRestoration = "manual";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* framer-motion skips transform/layout animations when the OS asks
          for reduced motion; App.css covers CSS ones (accessibility spec). */}
      <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <AppProvider>
            <ListsProvider>
              <FollowedPeopleProvider>
                <NotificationsProvider>
                  <App />
                </NotificationsProvider>
              </FollowedPeopleProvider>
            </ListsProvider>
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>
);
