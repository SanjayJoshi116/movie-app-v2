import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { FollowedPeopleContext, FollowedPeopleProvider, type FollowedPeopleContextType } from "../FollowedPeopleContext";
import { useFollowedPeople } from "../../hooks/useFollowedPeople";
import { AuthContext } from "../AuthContext";
import { getFollowedPeople, followPerson, unfollowPerson } from "../../api/userApi";

jest.mock("../../api/userApi", () => ({
  // One session throughout: the stale-session guard is covered in sessionGeneration.test.tsx.
  currentSessionGeneration: () => 0,
  isCurrentSession: () => true,
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

const BRAD = { id: 10, personId: 287, name: "Brad Pitt", profilePath: null, followedAt: "2026-10-01T10:00:00Z" };

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
    Promise.resolve({ data: { id: personId, personId, name, profilePath: null, followedAt: "2026-10-01T10:00:00Z" } })
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
    expect(screen.getByTestId("b")).toHaveTextContent("Tom Hanks,Brad Pitt");
    expect(a.isFollowing(31)).toBe(true);

    await act(async () => { await a.unfollow(287); });
    expect(screen.getByTestId("b")).toHaveTextContent("Tom Hanks");
    expect(screen.getByTestId("b")).not.toHaveTextContent("Brad Pitt");
  });

  it("a failed load sets error instead of an empty list, and retry() refetches", async () => {
    let a!: FollowedPeopleContextType;
    mockGet.mockRejectedValueOnce(new Error("down"));
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(a.error).toBe(true));
    expect(a.loading).toBe(false);
    expect(mockGet).toHaveBeenCalledTimes(1);

    act(() => a.retry());
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));
    expect(a.error).toBe(false);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("a failed reload keeps the list it already had", async () => {
    let a!: FollowedPeopleContextType;
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));
    mockGet.mockRejectedValueOnce(new Error("down"));
    act(() => a.retry());
    await waitFor(() => expect(a.error).toBe(true));
    expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt");
  });

  it("a double-click follow sends one request and both settle with its outcome", async () => {
    let a!: FollowedPeopleContextType;
    let release!: () => void;
    mockFollow.mockImplementation(
      (personId: number, name: string) =>
        new Promise((resolve) => {
          release = () => resolve({ data: { id: personId, personId, name, profilePath: null, followedAt: "2026-10-01T10:00:00Z" } });
        })
    );
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = a.follow(31, "Tom Hanks", null);
      second = a.follow(31, "Tom Hanks", null);
    });
    await act(async () => {
      release();
      await Promise.all([first, second]);
    });
    expect(mockFollow).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("a")).toHaveTextContent("Tom Hanks,Brad Pitt");
  });

  it("an unfollow during a pending follow runs after it, with its own outcome", async () => {
    let a!: FollowedPeopleContextType;
    let release!: () => void;
    mockFollow.mockImplementation(
      (personId: number, name: string) =>
        new Promise((resolve) => {
          release = () => resolve({ data: { id: personId, personId, name, profilePath: null, followedAt: "2026-10-01T10:00:00Z" } });
        })
    );
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));

    let follow!: Promise<void>;
    let unfollow!: Promise<void>;
    act(() => {
      follow = a.follow(31, "Tom Hanks", null);
      unfollow = a.unfollow(31);
    });
    expect(mockUnfollow).not.toHaveBeenCalled(); // queued behind the follow
    await act(async () => {
      release();
      await Promise.all([follow, unfollow]);
    });
    expect(mockFollow).toHaveBeenCalledTimes(1);
    expect(mockUnfollow).toHaveBeenCalledWith(31);
    expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt");
  });

  it("follows of different people are independent", async () => {
    let a!: FollowedPeopleContextType;
    mockFollow.mockImplementation(() => new Promise(() => {})); // both stay in flight
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));
    act(() => {
      void a.follow(31, "Tom Hanks", null);
      void a.follow(32, "Meryl Streep", null);
    });
    expect(mockFollow).toHaveBeenCalledTimes(2);
  });
});

describe("follow order and change counter", () => {
  it("puts a new follow first and bumps `changes` on follow and unfollow", async () => {
    let a!: FollowedPeopleContextType;
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));
    expect(a.changes).toBe(0);

    await act(async () => { await a.follow(7, "Greta Gerwig", null); });
    expect(screen.getByTestId("a")).toHaveTextContent("Greta Gerwig,Brad Pitt");
    expect(a.changes).toBe(1);

    await act(async () => { await a.unfollow(287); });
    expect(a.changes).toBe(2);
  });

  it("reading `changes` straight from the context doesn't start the fetch", () => {
    function Reader() {
      const ctx = React.useContext(FollowedPeopleContext);
      return <div data-testid="changes">{ctx?.changes}</div>;
    }
    render(<Shell><Reader /></Shell>);
    expect(screen.getByTestId("changes")).toHaveTextContent("0");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("reload() counts as a follow change, and refetches only for a mounted consumer", async () => {
    let ctx!: FollowedPeopleContextType;
    function Reader() {
      ctx = React.useContext(FollowedPeopleContext)!;
      return <div data-testid="changes">{ctx.changes}</div>;
    }
    const { unmount } = render(<Shell><Reader /></Shell>);
    act(() => ctx.reload());
    expect(screen.getByTestId("changes")).toHaveTextContent("1");
    expect(mockGet).not.toHaveBeenCalled(); // still lazy
    unmount();

    render(<Shell><Reader /><Consumer name="a" /></Shell>);
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    act(() => ctx.reload());
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("changes")).toHaveTextContent("1");
  });

  it("retry() alone is not a follow change", async () => {
    let ctx!: FollowedPeopleContextType;
    function Reader() {
      ctx = React.useContext(FollowedPeopleContext)!;
      return <div data-testid="changes">{ctx.changes}</div>;
    }
    render(<Shell><Reader /><Consumer name="a" /></Shell>);
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    act(() => ctx.retry());
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("changes")).toHaveTextContent("0");
  });
});

describe("a reload racing a follow (fix-session-sweep-f1)", () => {
  it("is run again instead of dropping a follow that settled during it", async () => {
    let a!: FollowedPeopleContextType;
    render(<Shell><Consumer name="a" onValue={(v) => { a = v; }} /></Shell>);
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Brad Pitt"));

    let answerStale!: (v: unknown) => void;
    mockGet
      .mockReturnValueOnce(new Promise((r) => { answerStale = r; })) // the reload, answered before the follow commits
      .mockResolvedValueOnce([{ ...BRAD, id: 11, personId: 500, name: "Kim" }, BRAD]); // its rerun
    act(() => a.reload());
    await act(() => a.follow(500, "Kim", null));
    await act(async () => answerStale([BRAD]));

    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("Kim"));
    expect(mockGet).toHaveBeenCalledTimes(3);
  });
});
