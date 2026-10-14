import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PersonCard from "../PersonCard";
import { FollowedPeopleContext, type FollowedPeopleContextType } from "../../context/FollowedPeopleContext";

// write-feedback: follow controls are disabled while follow state loads.

jest.mock("../../hooks/useToast", () => ({ useToast: () => ({ showSuccess: () => undefined, showError: () => undefined }) }));

const BRAD = { id: 287, name: "Brad Pitt", profile_path: null };

function renderCard(state: Partial<FollowedPeopleContextType>) {
  const value = {
    followed: [], loading: false, error: false, changes: 0,
    retry: () => undefined, reload: () => undefined, request: () => undefined,
    isFollowing: () => false, follow: async () => undefined, unfollow: async () => undefined,
    ...state,
  } as FollowedPeopleContextType;
  return render(
    <MemoryRouter>
      <FollowedPeopleContext.Provider value={value}>
        <PersonCard person={BRAD} onClick={() => undefined} />
      </FollowedPeopleContext.Provider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

it("is disabled and doesn't offer Follow while follow state loads", () => {
  renderCard({ loading: true, isFollowing: () => false });
  const button = screen.getByRole("button", { name: "Loading follow status for Brad Pitt" });
  expect(button).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Follow Brad Pitt" })).toBeNull();
  expect(button).not.toHaveTextContent("Follow");
});

it("offers Unfollow once the list has arrived", () => {
  renderCard({ loading: false, isFollowing: () => true });
  expect(screen.getByRole("button", { name: "Unfollow Brad Pitt" })).toBeEnabled();
});
