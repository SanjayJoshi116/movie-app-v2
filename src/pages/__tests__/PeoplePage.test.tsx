import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fetchPopularPeople, searchPeople } from "../../api/tmdb";
import { useAppContext } from "../../context/useAppContext";
import PeoplePage from "../PeoplePage";

jest.mock("../../api/tmdb", () => ({ __esModule: true, fetchPopularPeople: jest.fn(), searchPeople: jest.fn() }));
jest.mock("../../context/useAppContext", () => ({ useAppContext: jest.fn() }));
jest.mock("../../components/PersonCard", () => ({ person }: { person: { name: string } }) => <div>{person.name}</div>);

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
});

it("says no one matches a search with no results", async () => {
  // The page's own term comes from its URL, never the app-wide search term.
  (useAppContext as jest.Mock).mockReturnValue({ searchTerm: "ignored", includeAdult: false });
  (searchPeople as jest.Mock).mockResolvedValue({ data: { results: [], total_pages: 0 } });
  render(<MemoryRouter initialEntries={["/people?q=zzqx"]}><PeoplePage /></MemoryRouter>);
  expect(await screen.findByText('No people match "zzqx".')).toBeInTheDocument();
  expect(fetchPopularPeople).not.toHaveBeenCalled();
});

it("shows popular people when only the app-wide search term is set", async () => {
  (useAppContext as jest.Mock).mockReturnValue({ searchTerm: "batman", includeAdult: false });
  (fetchPopularPeople as jest.Mock).mockResolvedValue({ data: { results: [], total_pages: 0 } });
  render(<MemoryRouter initialEntries={["/people"]}><PeoplePage /></MemoryRouter>);
  expect(await screen.findByText("Popular People")).toBeInTheDocument();
  expect(searchPeople).not.toHaveBeenCalledWith("batman", expect.anything(), expect.anything());
});
