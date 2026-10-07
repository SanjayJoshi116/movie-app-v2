import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { FollowedPeopleProvider, type FollowedPeopleContextType } from "../FollowedPeopleContext";
import { useFollowedPeople } from "../../hooks/useFollowedPeople";
import { AuthContext } from "../AuthContext";
import { getFollowedPeople, followPerson, unfollowPerson } from "../../api/userApi";

jest.mock("../../api/userApi", () => ({
  __esModule: true,
  getFollowedPeople: jest.fn(),
  followPerson: jest.fn(),
  unfollowPerson: jest.fn(),
}));

const mockGet = getFollowedPeople as jest.Mock;
const mockFollow = followPerson as jest.Mock;
const mockUnfollow = unfollowPerson as jest.Mock;

const auth = {
  user: { id: 1, username: "u", email: "", first_name: "", last_name: "", is_staff: false, avatar_url: null },
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  setUserData: jest.fn(),
};

const BRAD = { id: 10, personId: 287, name: "Brad Pitt", profilePath: null };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={auth}>
      <FollowedPeopleProvider>{children}</FollowedPeopleProvider>
    </AuthContext.Provider>
  );
}

/** Renders a consumer and hands its latest context value to `onValue`. */
function Consumer({ name, onValue }: { name: string; onValue?: (v: FollowedPeopleContextType) => void }) {
  const value = useFollowedPeople();
  onValue?.(value);
  return <div data-testid={name}>{value.followed.map((f) => f.name).join(",") || "none"}</div>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue([BRAD]);
  mockFollow.mockImplementation((personId: number, name: string) =>
    Promise.resolve({ data: { id: personId, personId, name, profilePath: null } })
  );
  mockUnfollow.mockResolvedValue({});
});

describe("FollowedPeopleProvider", () => {
  it("doesn't fetch until a consumer mounts", () => {
    render(<Shell><div>no consumers</div></Shell>);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("shares one fetch between two consumers", async () => {
    render(<Shell><Consumer name="a" /><Consumer name="b" /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));
    expect(screen.getByTestId("b")).toHaveTextContent("Brad Pitt");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("shows a follow and an unfollow to every consumer", async () => {
    let a!: FollowedPeopleContextType;
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /><Consumer name="b" /></Shell>);
    await waitFor(() => expect(screen.getByTestId("b")).toHaveTextContent("Brad Pitt"));

    await act(async () => { await a.follow(31, "Tom Hanks", null); });
    expect(screen.getByTestId("b")).toHaveTextContent("Brad Pitt,Tom Hanks");
    expect(a.isFollowing(31)).toBe(true);

    await act(async () => { await a.unfollow(287); });
    expect(screen.getByTestId("b")).toHaveTextContent("Tom Hanks");
    expect(screen.getByTestId("b")).not.toHaveTextContent("Brad Pitt");
  });
});
