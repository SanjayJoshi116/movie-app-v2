import { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import userApi, { publicApi, SessionEndedError } from "../../api/userApi";
import { AuthProvider, useAuth } from "../AuthContext";

// fix-session-sweep-f1: a profile or avatar response that lands after a
// sign-out and someone else's sign-in must not hand the tab to the old account.

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const USER_A = { id: 1, username: "a", email: "a@x.test", first_name: "", last_name: "", is_staff: false, avatar_url: null };
const USER_B = { ...USER_A, id: 2, username: "b", email: "b@x.test" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("cinedb_access", "access-a");
  localStorage.setItem("cinedb_refresh", "refresh-a");
  localStorage.setItem("cinedb_user", JSON.stringify(USER_A));
  jest.spyOn(publicApi, "post").mockImplementation(async (url: string) => {
    if (url === "/auth/login/") return { data: { access: "access-b", refresh: "refresh-b", user: USER_B } };
    return { data: {} }; // logout
  });
});

afterEach(() => jest.restoreAllMocks());

async function mountAsA() {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe(1));
  return result;
}

async function switchToB(auth: { current: ReturnType<typeof useAuth> }) {
  act(() => auth.current.logout());
  await act(() => auth.current.login("b", "pw"));
  expect(auth.current.user?.id).toBe(2);
}

function expectSignedInAsB(auth: { current: ReturnType<typeof useAuth> }) {
  expect(auth.current.user?.id).toBe(2);
  expect(localStorage.getItem("cinedb_access")).toBe("access-b");
  expect(localStorage.getItem("cinedb_refresh")).toBe("refresh-b");
  expect(JSON.parse(localStorage.getItem("cinedb_user") as string).id).toBe(2);
}

it("drops A's password-change response that lands after B signed in", async () => {
  let answer!: (v: unknown) => void;
  jest.spyOn(userApi, "patch").mockReturnValue(new Promise((resolve) => { answer = resolve; }) as never);
  const auth = await mountAsA();

  let saving!: Promise<void>;
  act(() => { saving = auth.current.updateProfile({ current_password: "old", new_password: "new" }); });
  await switchToB(auth);
  await act(async () => {
    answer({ data: { ...USER_A, access: "access-a2", refresh: "refresh-a2" } });
    // Rejects, so the dialog doesn't report a save this tab threw away.
    await expect(saving).rejects.toBeInstanceOf(SessionEndedError);
  });

  expectSignedInAsB(auth);
});

it("still stores a password change answered in the same session", async () => {
  jest.spyOn(userApi, "patch").mockResolvedValue({ data: { ...USER_A, first_name: "Ann", access: "access-a2", refresh: "refresh-a2" } } as never);
  const auth = await mountAsA();
  await act(() => auth.current.updateProfile({ current_password: "old", new_password: "new" }));
  expect(auth.current.user?.first_name).toBe("Ann");
  expect(localStorage.getItem("cinedb_access")).toBe("access-a2");
});

it("ignores A's avatar response once B is signed in", async () => {
  const auth = await mountAsA();
  await switchToB(auth);
  let applied = true;
  act(() => { applied = auth.current.setUserData({ ...USER_A, avatar_url: "/media/a.jpg" }); });
  expect(applied).toBe(false);
  expectSignedInAsB(auth);
});
