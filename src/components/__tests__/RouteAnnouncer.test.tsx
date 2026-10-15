import { useEffect, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import RouteAnnouncer, { ANNOUNCE_SETTLE_MS } from "../RouteAnnouncer";
import { usePageTitle } from "../../hooks/usePageTitle";

// accessibility spec: each page has its own title, and in-app navigation is
// announced politely without moving focus.

function Page({ name }: { name?: string }) {
  usePageTitle(name);
  return null;
}

let go: (path: string) => void;
function Nav() {
  const navigate = useNavigate();
  go = navigate;
  return null;
}

function Detail() {
  // A detail page names itself once its fetch lands.
  const [name, setName] = useState<string | undefined>("Movie");
  useEffect(() => { const t = setTimeout(() => setName("Dune"), 300); return () => clearTimeout(t); }, []);
  return <Page name={name} />;
}

function renderApp(initial = "/watchlist") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Nav />
      <button type="button">Stay</button>
      <RouteAnnouncer />
      <Routes>
        <Route path="/watchlist" element={<Page name="Watchlist" />} />
        <Route path="/lists" element={<Page name="My Lists" />} />
        <Route path="/movie/1" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  act(() => { jest.advanceTimersByTime(ANNOUNCE_SETTLE_MS * 2); });
  expect(screen.getByTestId("route-announcer")).toHaveTextContent("");
  act(() => go("/lists"));
  act(() => { jest.advanceTimersByTime(ANNOUNCE_SETTLE_MS); });
  expect(screen.getByRole("status")).toHaveTextContent("My Lists · CINE DB");
});

it("announces a detail page's loaded name, not its placeholder", () => {
  renderApp();
  act(() => go("/movie/1"));
  act(() => { jest.advanceTimersByTime(300); });
  act(() => { jest.advanceTimersByTime(ANNOUNCE_SETTLE_MS); });
  expect(screen.getByRole("status")).toHaveTextContent("Dune · CINE DB");
});

it("leaves focus alone", () => {
  renderApp();
  const stay = screen.getByRole("button", { name: "Stay" });
  act(() => stay.focus());
  act(() => go("/lists"));
  act(() => { jest.advanceTimersByTime(ANNOUNCE_SETTLE_MS); });
  expect(stay).toHaveFocus();
});
