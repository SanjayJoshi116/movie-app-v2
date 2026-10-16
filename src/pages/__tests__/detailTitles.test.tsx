import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { fetchMovieDetails, fetchPerson, fetchPersonImages, fetchPersonMovieCredits, fetchPersonTVCredits, fetchTVDetails } from "../../api/tmdb";
import { subscribePageTitle } from "../../hooks/usePageTitle";
import type { PageTitleEvent } from "../../hooks/usePageTitle";
import MovieDetailPage from "../MovieDetailPage";
import TVDetailPage from "../TVDetailPage";
import PersonPage from "../PersonPage";

jest.mock("../../api/tmdb", () => ({
  __esModule: true,
  fetchMovieDetails: jest.fn(),
  fetchTVDetails: jest.fn(),
  fetchPerson: jest.fn(),
  fetchPersonMovieCredits: jest.fn(),
  fetchPersonTVCredits: jest.fn(),
  fetchPersonImages: jest.fn(),
}));
jest.mock("../../components/MovieDetails", () => ({ __esModule: true, default: () => <div>movie body</div> }));
jest.mock("../../components/TVShowDetails", () => ({ __esModule: true, default: () => <div>tv body</div> }));
jest.mock("../../hooks/useFollowedPeople", () => ({
  useFollowedPeople: () => ({ isFollowing: () => false, follow: jest.fn(), unfollow: jest.fn(), error: null, loading: false }),
}));
jest.mock("../../hooks/useToast", () => {
  const toast = { showSuccess: jest.fn(), showError: jest.fn() };
  return { useToast: () => toast };
});

const notFound = Object.assign(new Error("404"), { response: { status: 404 } });
const failed = new Error("down");

const pages = [
  { kind: "movie", Page: MovieDetailPage, fetch: fetchMovieDetails, generic: "Movie", notFound: "Movie not found", failed: "Failed to load movie details", data: { id: 1, title: "Dune" }, name: "Dune" },
  { kind: "tv", Page: TVDetailPage, fetch: fetchTVDetails, generic: "TV Show", notFound: "TV show not found", failed: "Failed to load TV show details", data: { id: 1, name: "Severance" }, name: "Severance" },
  { kind: "person", Page: PersonPage, fetch: fetchPerson, generic: "Person", notFound: "Person not found", failed: "Failed to load this person", data: { id: 1, name: "Brad Pitt", biography: "" }, name: "Brad Pitt" },
] as const;

let events: PageTitleEvent[] = [];
let unsubscribe = () => {};

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  events = [];
  unsubscribe = subscribePageTitle((e) => { events.push(e); });
  // The pages log their failed loads.
  jest.spyOn(console, "error").mockImplementation(() => {});
  (fetchPersonMovieCredits as jest.Mock).mockResolvedValue({ data: { cast: [], crew: [] } });
  (fetchPersonTVCredits as jest.Mock).mockResolvedValue({ data: { cast: [], crew: [] } });
  (fetchPersonImages as jest.Mock).mockResolvedValue({ data: { profiles: [] } });
});

afterEach(() => {
  unsubscribe();
  (console.error as jest.Mock).mockRestore();
});

const renderAt = (kind: string, Page: React.ComponentType, id: string) =>
  render(
    <MemoryRouter initialEntries={[`/${kind}/${id}`]}>
      <Routes><Route path={`/${kind}/:id`} element={<Page />} /></Routes>
    </MemoryRouter>,
  );

const settled = () => events.filter((e) => e && !e.loading).map((e) => e!.title);

describe.each(pages)("$kind page title", (p) => {
  it("is 'Page Not Found' for an invalid id, even though the page's own title runs last", async () => {
    renderAt(p.kind, p.Page, "abc");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(document.title).toBe("Page Not Found · CINE DB");
    expect(settled()).not.toContain(`${p.generic} · CINE DB`);
    expect(p.fetch).not.toHaveBeenCalled();
  });

  it("names the not-found state on a 404", async () => {
    (p.fetch as jest.Mock).mockRejectedValue(notFound);
    renderAt(p.kind, p.Page, "999");
    expect(await screen.findByText(p.notFound)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(`${p.notFound} · CINE DB`));
    expect(settled()).toEqual([`${p.notFound} · CINE DB`]);
  });

  it("names the error state on a failed load, never settling on the generic title", async () => {
    (p.fetch as jest.Mock).mockRejectedValue(failed);
    renderAt(p.kind, p.Page, "999");
    expect(await screen.findByText(p.failed)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(`${p.failed} · CINE DB`));
    expect(settled()).toEqual([`${p.failed} · CINE DB`]);
  });

  it("shows and names the error state when the request succeeds with an empty body", async () => {
    (p.fetch as jest.Mock).mockResolvedValue({ data: "" });
    renderAt(p.kind, p.Page, "999");
    expect(await screen.findByText(p.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(`${p.failed} · CINE DB`));
    expect(settled()).toEqual([`${p.failed} · CINE DB`]);
  });

  it("uses the loaded name once it arrives", async () => {
    (p.fetch as jest.Mock).mockResolvedValue({ data: p.data });
    renderAt(p.kind, p.Page, "1");
    await waitFor(() => expect(document.title).toBe(`${p.name} · CINE DB`));
    expect(settled()).toEqual([`${p.name} · CINE DB`]);
  });
});

it("keeps the generic title for a movie TMDB gave no name", async () => {
  (fetchMovieDetails as jest.Mock).mockResolvedValue({ data: { id: 1, title: "" } });
  renderAt("movie", MovieDetailPage, "1");
  expect(await screen.findByText("movie body")).toBeInTheDocument();
  await waitFor(() => expect(document.title).toBe("Movie · CINE DB"));
  expect(settled()).toEqual(["Movie · CINE DB"]);
});

// Routes keyed on the path, as App.tsx renders them: a new id is a fresh page.
function KeyedRoutes() {
  const location = useLocation();
  return (
    <>
      <Link to="/person/2">next person</Link>
      <Routes location={location} key={location.pathname}>
        <Route path="/person/:id" element={<PersonPage />} />
      </Routes>
    </>
  );
}

it("never reports or shows the previous person under the new id", async () => {
  (fetchPerson as jest.Mock).mockImplementation(async (id: number) =>
    id === 1 ? { data: { id: 1, name: "Brad Pitt", biography: "" } } : new Promise(() => {}));
  render(<MemoryRouter initialEntries={["/person/1"]}><KeyedRoutes /></MemoryRouter>);
  await waitFor(() => expect(document.title).toBe("Brad Pitt · CINE DB"));

  events = [];
  fireEvent.click(screen.getByText("next person"));
  await waitFor(() => expect(fetchPerson).toHaveBeenCalledWith(2));
  expect(settled()).not.toContain("Brad Pitt · CINE DB");
  expect(screen.queryByText("Brad Pitt")).toBeNull();
  expect(document.title).toBe("Person · CINE DB");
});
