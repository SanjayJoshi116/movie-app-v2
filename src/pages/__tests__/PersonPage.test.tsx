import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fetchPerson, fetchPersonImages, fetchPersonMovieCredits, fetchPersonTVCredits } from "../../api/tmdb";
import PersonPage from "../PersonPage";

jest.mock("../../api/tmdb", () => ({
  __esModule: true,
  fetchPerson: jest.fn(),
  fetchPersonMovieCredits: jest.fn(),
  fetchPersonTVCredits: jest.fn(),
  fetchPersonImages: jest.fn(),
}));
jest.mock("../../hooks/useFollowedPeople", () => ({
  useFollowedPeople: () => ({ isFollowing: () => false, follow: jest.fn(), unfollow: jest.fn(), error: null, loading: false }),
}));
jest.mock("../../hooks/useToast", () => {
  const toast = { showSuccess: jest.fn(), showError: jest.fn() };
  return { useToast: () => toast };
});
jest.mock("../../components/MediaCardGrid", () => ({
  MediaCardGrid: ({ items }: { items: { title: string }[] }) => <div>{items.map((i) => i.title).join(", ")}</div>,
}));

const person = { id: 287, name: "Brad Pitt", biography: "", known_for_department: "Acting", profile_path: null };
const credits = (titles: string[]) => ({
  data: { cast: titles.map((title, i) => ({ id: i + 1, title, release_date: "2000-01-01", credit_id: `c${i}` })), crew: [] },
});

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  (fetchPerson as jest.Mock).mockResolvedValue({ data: person });
  (fetchPersonImages as jest.Mock).mockResolvedValue({ data: { profiles: [] } });
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/person/287"]}>
      <Routes><Route path="/person/:id" element={<PersonPage />} /></Routes>
    </MemoryRouter>,
  );

it("shows an error with Retry, not 'No credits', when the credit requests fail", async () => {
  (fetchPersonMovieCredits as jest.Mock).mockRejectedValueOnce(new Error("down")).mockResolvedValue(credits(["Se7en"]));
  (fetchPersonTVCredits as jest.Mock).mockRejectedValueOnce(new Error("down")).mockResolvedValue(credits([]));
  renderPage();
  expect(await screen.findByText("Couldn't load credits")).toBeInTheDocument();
  expect(screen.queryByText("No credits available")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
  expect(await screen.findByRole("tab", { name: "Movies (1)" })).toBeInTheDocument();
  expect(fetchPerson).toHaveBeenCalledTimes(1);
  expect(fetchPersonMovieCredits).toHaveBeenCalledTimes(2);
});

it("keeps the tabs that loaded and flags the partial failure", async () => {
  (fetchPersonMovieCredits as jest.Mock).mockResolvedValue(credits(["Se7en"]));
  (fetchPersonTVCredits as jest.Mock).mockRejectedValue(new Error("down"));
  renderPage();
  expect(await screen.findByText("Some credits couldn't be loaded.")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Movies (1)" })).toBeInTheDocument();
});

it("says no credits only when the requests succeeded with none", async () => {
  (fetchPersonMovieCredits as jest.Mock).mockResolvedValue(credits([]));
  (fetchPersonTVCredits as jest.Mock).mockResolvedValue(credits([]));
  renderPage();
  expect(await screen.findByText("No credits available")).toBeInTheDocument();
  expect(screen.queryByText("Couldn't load credits")).toBeNull();
});
