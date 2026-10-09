import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spin } from "antd";
import { createTMDBSession } from "../api/userApi";
import { useToast } from "../hooks/useToast";
import { getApiError } from "../utils/apiError";

function TMDBCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useToast();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const requestToken = searchParams.get("request_token");
    const approved = searchParams.get("approved");

    if (!requestToken || approved !== "true") {
      showError("TMDB authorisation was denied or the link is invalid.");
      navigate("/movies", { replace: true });
      return;
    }

    createTMDBSession(requestToken)
      .then(() => {
        showSuccess("TMDB account connected! Your ratings will now sync.");
        navigate("/movies", { replace: true });
      })
      .catch((err) => {
        showError(getApiError(err, "Failed to complete TMDB connection. Please try again."));
        navigate("/movies", { replace: true });
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <Spin size="large" tip="Connecting TMDB account…" />
    </div>
  );
}

export default TMDBCallbackPage;
