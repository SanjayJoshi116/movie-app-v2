import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import { ListsProvider } from "./context/ListsContext";
import { FollowedPeopleProvider } from "./context/FollowedPeopleContext";
import { NotificationsProvider } from "./hooks/useNotifications";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// Prevent browser from auto-restoring scroll; our pages handle it explicitly
window.history.scrollRestoration = "manual";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
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
    </ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals();
