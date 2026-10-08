import { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const USER_A = { id: 1, username: "a", email: "a@x.test", first_name: "", last_name: "", is_staff: false, avatar_url: null };
const USER_B = { ...USER_A, id: 2, username: "b", email: "b@x.test" };

const realLocation = window.location;
let reload: jest.Mock;

/** What another tab's write looks like here: storage already changed, then the event. */
function otherTab(write: () => void, key: string | null) {
  act(() => {
    write();
    window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }));
  });
}

function signIn(user: typeof USER_A, access = `access-${user.id}`) {
  localStorage.setItem("cinedb_access", access);
  localStorage.setItem("cinedb_refresh", `refresh-${user.id}`);
  localStorage.setItem("cinedb_user", JSON.stringify(user));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signIn(USER_A);
  sessionStorage.setItem("cinedb_recommendations", "[{\"cached\":\"A\"}]");
  reload = jest.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, reload } });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

async function mountSignedIn() {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  return result;
}

describe("cross-tab session sync", () => {
  it("shows the signed-out state and drops this tab's caches when another tab signs out", async () => {
    const auth = await mountSignedIn();
    otherTab(() => {
      ["cinedb_access", "cinedb_refresh", "cinedb_user"].forEach((k) => localStorage.removeItem(k));
    }, "cinedb_access");
    expect(auth.current.user).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it("treats another tab's localStorage.clear() as a sign-out", async () => {
    const auth = await mountSignedIn();
    otherTab(() => localStorage.clear(), null);
    expect(auth.current.user).toBeNull();
  });

  it("reloads when another tab signs in as a different account", async () => {
    const auth = await mountSignedIn();
    otherTab(() => signIn(USER_B), "cinedb_user");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.length).toBe(0);
    expect(auth.current.user?.id).toBe(1); // A's UI stays only until the reload lands
  });

  it("adopts a same-account profile edit without reloading", async () => {
    const auth = await mountSignedIn();
    otherTab(() => localStorage.setItem("cinedb_user", JSON.stringify({ ...USER_A, first_name: "Ann" })), "cinedb_user");
    expect(auth.current.user?.first_name).toBe("Ann");
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("cinedb_recommendations")).not.toBeNull();
  });

  it("ignores a token rotation by the same account", async () => {
    const auth = await mountSignedIn();
    const before = auth.current.user;
    otherTab(() => localStorage.setItem("cinedb_access", "access-rotated"), "cinedb_access");
    expect(auth.current.user).toBe(before);
    expect(reload).not.toHaveBeenCalled();
  });

  it("picks up a sign-in from another tab while signed out here", async () => {
    localStorage.clear();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    otherTab(() => signIn(USER_B), "cinedb_user");
    expect(result.current.user?.id).toBe(2);
    expect(reload).not.toHaveBeenCalled();
  });
});
