import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import App from "../App";
import { isAuthOnlyPath, isResetPasswordPath, postLoginPath } from "../utils/postLoginPath";

// fix-shell-sweep-f5: the shell's guard, route boundaries, restored state and
// filter drawer. Pages and nav are stand-ins; only the shell is under test.

jest.setTimeout(30_000);

const mockAuth = { isAuthenticated: true, isLoading: false, signedOutInThisTab: false };
jest.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("../context/UIContext", () => ({ useUIContext: () => ({ theme: "dark" }) }));
jest.mock("../components/RouteAnnouncer", () => () => null);
jest.mock("../components/BottomNav", () => () => null);
// The real sidebar's Filters button, reduced to the toggle the shell hands it.
jest.mock("../components/Sidebar", () => ({ onToggleFilterPanel }: { onToggleFilterPanel: () => void }) => (
  <button onClick={onToggleFilterPanel}>toggle filters</button>
));
jest.mock("../components/layout/FilterPanel", () => ({
  FilterPanel: ({ open }: { open: boolean }) => (open ? <div>filter drawer open</div> : null),
}));
jest.mock("../pages/HomePage", () => ({ tab }: { tab: string }) => <div>{`home ${tab}`}</div>);
jest.mock("../pages/AnimePage", () => () => <div>anime page</div>);
jest.mock("../pages/MovieDetailPage", () => () => <div>movie page</div>);
jest.mock("../pages/LoginPage", () => () => <div>login form</div>);
// A page whose code or render fails, as a stale chunk after a deploy does.
jest.mock("../pages/TMDBCallbackPage", () => () => {
  throw new Error("Loading chunk 42 failed.");
});

let go: (to: string, opts?: { state?: unknown }) => void;
function Nav() {
  const navigate = useNavigate();
  go = (to, opts) => navigate(to, opts);
  return null;
}

function renderAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Nav />
      <App />
    </MemoryRouter>,
  );
}

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

beforeEach(() => {
  Object.assign(mockAuth, { isAuthenticated: true, isLoading: false, signedOutInThisTab: false });
});

describe("sign-in page check", () => {
  it.each(["/login", "/login/", "/LOGIN", "/Register//", "/forgot-password/"])("%s is a sign-in page", (path) => {
    expect(isAuthOnlyPath(path)).toBe(true);
  });

  it.each(["/", "/movies", "/login-help", "/reset-password/a/b"])("%s isn't", (path) => {
    expect(isAuthOnlyPath(path)).toBe(false);
  });

  it("treats a reset link as public however it's written", () => {
    expect(isResetPasswordPath("/reset-password/a/b")).toBe(true);
    expect(isResetPasswordPath("/Reset-Password/a/b/")).toBe(true);
    expect(isResetPasswordPath("/movies")).toBe(false);
  });

  it("doesn't send a sign-in from /login/ back to the form", () => {
    expect(postLoginPath({ from: { pathname: "/login/" } })).toBe("/movies");
  });

  it.each(["/login/", "/LOGIN"])("sends a signed-in user on from %s", async (path) => {
    renderAt(path);
    expect(await screen.findByText("home movies")).toBeInTheDocument();
    expect(screen.queryByText("login form")).toBeNull();
  });
});

it("shows a failing page's error inside the layout, not the root fallback", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    renderAt("/tmdb-callback");
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeInTheDocument();
    // The shell (here, the sidebar stand-in) stays.
    expect(screen.getByRole("button", { name: "toggle filters" })).toBeInTheDocument();
  } finally {
    error.mockRestore();
  }
});

it("ignores a restored Anime category that isn't text", async () => {
  renderAt("/anime", { isReturn: true, activeCategory: 42 });
  expect(await screen.findByText("anime page")).toBeInTheDocument();
});

describe("filter drawer", () => {
  it("is closed again after leaving the browse pages", async () => {
    renderAt("/movies");
    await screen.findByText("home movies");
    fireEvent.click(screen.getByRole("button", { name: "toggle filters" }));
    expect(screen.getByText("filter drawer open")).toBeInTheDocument();

    act(() => go("/movie/550"));
    await screen.findByText("movie page");
    act(() => go("/tv"));
    expect(await screen.findByText("home tv")).toBeInTheDocument();
    expect(screen.queryByText("filter drawer open")).toBeNull();
  });

  it("doesn't reopen when Back returns to the scope it was open on", async () => {
    renderAt("/movies");
    await screen.findByText("home movies");
    fireEvent.click(screen.getByRole("button", { name: "toggle filters" }));
    expect(screen.getByText("filter drawer open")).toBeInTheDocument();

    act(() => go("/movie/550"));
    await screen.findByText("movie page");
    act(() => go("/movies"));
    expect(await screen.findByText("home movies")).toBeInTheDocument();
    expect(screen.queryByText("filter drawer open")).toBeNull();
  });

  it("is closed after a sign-out and the next sign-in", async () => {
    const { rerender } = renderAt("/movies");
    await screen.findByText("home movies");
    fireEvent.click(screen.getByRole("button", { name: "toggle filters" }));
    expect(screen.getByText("filter drawer open")).toBeInTheDocument();

    mockAuth.isAuthenticated = false;
    rerender(<MemoryRouter initialEntries={["/movies"]}><Nav /><App /></MemoryRouter>);
    mockAuth.isAuthenticated = true;
    act(() => go("/movies"));
    expect(await screen.findByText("home movies")).toBeInTheDocument();
    expect(screen.queryByText("filter drawer open")).toBeNull();
  });
});
