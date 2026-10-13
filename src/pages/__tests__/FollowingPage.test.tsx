import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { fetchFollowedPeopleRecommendations, type FollowedPersonEntry } from "../../api/userApi";
import { useFollowedPeople } from "../../hooks/useFollowedPeople";
import FollowingPage from "../FollowingPage";

jest.mock("../../api/userApi", () => ({
  __esModule: true,
  fetchFollowedPeopleRecommendations: jest.fn(),
}));
jest.mock("../../hooks/useFollowedPeople", () => ({ useFollowedPeople: jest.fn() }));
// Only the effect is under test; the cards themselves need app-wide providers.
jest.mock("../../components/PersonCard", () => () => null);
jest.mock("../RecommendationsPage", () => ({ SectionRow: () => null }));

const mockRecs = fetchFollowedPeopleRecommendations as jest.Mock;
const mockFollowed = useFollowedPeople as jest.Mock;

const person = (personId: number): FollowedPersonEntry => ({ id: personId, personId, name: `P${personId}`, profilePath: null, followedAt: "2026-10-01T10:00:00Z" });
const followedState = (followed: FollowedPersonEntry[]) => ({ followed, loading: false, error: false, retry: jest.fn() });

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

it("refetches recommendations when the followed set changes at the same size", async () => {
  mockRecs.mockResolvedValue({ data: [] });
  mockFollowed.mockReturnValue(followedState([person(1)]));
  const ui = () => <MemoryRouter><FollowingPage /></MemoryRouter>;
  const { rerender } = render(ui());
  await waitFor(() => expect(mockRecs).toHaveBeenCalledTimes(1));

  // Follow #2 and unfollow #1: the count is still 1.
  mockFollowed.mockReturnValue(followedState([person(2)]));
  rerender(ui());
  await waitFor(() => expect(mockRecs).toHaveBeenCalledTimes(2));

  // The same set again (a new array): nothing to refetch.
  mockFollowed.mockReturnValue(followedState([person(2)]));
  rerender(ui());
  await new Promise((r) => setTimeout(r, 20));
  expect(mockRecs).toHaveBeenCalledTimes(2);
});
