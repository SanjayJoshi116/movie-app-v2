import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { LoadError } from "../components/LoadError";
import { isPlainClick } from "../components/CardLink";
import { usePageTitle, NOT_FOUND_PAGE_TITLE } from "../hooks/usePageTitle";

/** Unknown paths: say so (keeping the typed address) instead of silently redirecting. */
export default function NotFoundPage() {
  usePageTitle(NOT_FOUND_PAGE_TITLE);
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center" }}>
      <LoadError notFound title="Page not found" subTitle="There's nothing at this address." />
      {/* href makes antd render a real <a> (not a button nested in a link);
          plain clicks stay in the SPA, modifier clicks open a new tab. */}
      <Button
        type="primary"
        href="/movies"
        onClick={(e) => {
          if (isPlainClick(e)) {
            e.preventDefault();
            navigate("/movies");
          }
        }}
      >
        Go to Movies
      </Button>
    </div>
  );
}
