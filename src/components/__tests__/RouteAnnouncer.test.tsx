import { StrictMode, useEffect, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import RouteAnnouncer, { ANNOUNCE_SETTLE_MS } from "../RouteAnnouncer";
import { usePageTitle } from "../../hooks/usePageTitle";

// accessibility spec: each page has its own title, and in-app navigation is
// announced politely without moving focus: the new page's settled title,
// never the previous page's or a placeholder, and never the first load.

function Page({ name, loading }: { name?: string; loading?: boolean }) {
  usePageTitle(name, { loading });
  return null;
}

let go: (path: string) => void;
function Nav() {
  const navigate = useNavigate();
  go = navigate;
  return null;
}

const NAMES: Record<string, string> = { "1": "Dune", "2": "Arrival" };

function Detail() {
  // A detail page names itself once its fetch lands (300 ms; /movie/9 fails,
  // /movie/slow takes 3 s), resetting to loading when its id changes.
  const { id = "" } = useParams();
  const [state, setState] = useState<{ name: string; loading: boolean }>({ name: "Movie", loading: true });
  useEffect(() => {
    setState({ name: "Movie", loading: true });
    const t = setTimeout(
      () => setState(id === "9" ? { name: "Movie", loading: false } : { name: NAMES[id] ?? "Blade Runner", loading: false }),
      id === "slow" ? 3000 : 300,
    );
    return () => clearTimeout(t);
  }, [id]);
  return <Page name={state.name} loading={state.loading} />;
}

function LazyPage() {
  // Stands in for a lazy route whose code is still downloading: the Suspense
  // fallback sets no title until the page itself renders.
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 2500); return () => clearTimeout(t); }, []);
  return ready ? <Page name="Stats" /> : null;
}

function renderApp(initial = "/watchlist", strict = false) {
  const tree = (
    <MemoryRouter initialEntries={[initial]}>
      <Nav />
      <button type="button">Stay</button>
      <RouteAnnouncer />
      <Routes>
        <Route path="/watchlist" element={<Page name="Watchlist" />} />
        <Route path="/lists" element={<Page name="My Lists" />} />
        <Route path="/stats" element={<LazyPage />} />
        <Route path="/movie/:id" element={<Detail />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const status = () => screen.getByTestId("route-announcer");
// One step per timer: a state update inside act() renders only when it ends,
// so a timer the re-render schedules can't fire in the same advance.
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("sets the tab title per page", () => {
  renderApp();
  expect(document.title).toBe("Watchlist · CINE DB");
  act(() => go("/lists"));
  expect(document.title).toBe("My Lists · CINE DB");
});

it("doesn't announce the first page, announces a navigation once the title settles", () => {
  renderApp();
  advance(ANNOUNCE_SETTLE_MS * 2);
  expect(status()).toHaveTextContent("");
  act(() => go("/lists"));
  advance(ANNOUNCE_SETTLE_MS);
  expect(screen.getByRole("status")).toHaveTextContent("My Lists · CINE DB");
});

it("doesn't announce the first page under StrictMode's effect replay", () => {
  renderApp("/watchlist", true);
  advance(ANNOUNCE_SETTLE_MS * 2);
  expect(status()).toHaveTextContent("");
  act(() => go("/lists"));
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("My Lists · CINE DB");
});

it("announces a detail page's loaded name, not its placeholder", () => {
  renderApp();
  act(() => go("/movie/1"));
  advance(300);
  advance(ANNOUNCE_SETTLE_MS);
  expect(screen.getByRole("status")).toHaveTextContent("Dune · CINE DB");
});

it("waits for a slow detail page's name instead of announcing the placeholder", () => {
  renderApp();
  act(() => go("/movie/slow"));
  advance(2500);
  expect(status()).toHaveTextContent("");
  advance(500);
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("Blade Runner · CINE DB");
});

it("announces the generic title once a detail load fails", () => {
  renderApp();
  act(() => go("/movie/9"));
  advance(300);
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("Movie · CINE DB");
});

it("doesn't announce the previous page while the next one's code loads", () => {
  renderApp();
  act(() => go("/stats"));
  advance(2000);
  expect(status()).toHaveTextContent("");
  advance(500);
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("Stats · CINE DB");
});

it("doesn't announce the old name when only the id changes", () => {
  renderApp();
  act(() => go("/movie/1"));
  advance(300);
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("Dune · CINE DB");
  act(() => go("/movie/2"));
  advance(300);
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("Arrival · CINE DB");
});

it("announces going back to a page visited before", () => {
  renderApp();
  act(() => go("/lists"));
  advance(ANNOUNCE_SETTLE_MS);
  act(() => go("/watchlist"));
  advance(ANNOUNCE_SETTLE_MS);
  expect(status()).toHaveTextContent("Watchlist · CINE DB");
});

it("leaves focus alone", () => {
  renderApp();
  const stay = screen.getByRole("button", { name: "Stay" });
  act(() => stay.focus());
  act(() => go("/lists"));
  advance(ANNOUNCE_SETTLE_MS);
  expect(stay).toHaveFocus();
});
