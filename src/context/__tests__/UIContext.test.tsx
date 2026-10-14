import React from "react";
import { act, renderHook } from "@testing-library/react";
import { UIProvider, useUIContext } from "../UIContext";
import { AuthContext } from "../AuthContext";

// auth-session: browse settings end with the session.

function renderUI() {
  const auth = { isAuthenticated: true };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={auth as unknown as React.ContextType<typeof AuthContext>}>
      <UIProvider>{children}</UIProvider>
    </AuthContext.Provider>
  );
  const view = renderHook(() => useUIContext(), { wrapper });
  const setSignedIn = (signedIn: boolean) => { auth.isAuthenticated = signedIn; view.rerender(); };
  return { ...view, setSignedIn };
}

it("resets search, adult content and genres when the user signs out", () => {
  const { result, setSignedIn } = renderUI();
  act(() => {
    result.current.setSearchTerm("fight");
    result.current.setIncludeAdult(true);
    result.current.setGenres([28, 35]);
  });
  setSignedIn(false);
  expect(result.current.searchTerm).toBe("");
  expect(result.current.includeAdult).toBe(false);
  expect(result.current.selectedGenres).toEqual([]);
});

it("keeps the settings while the session continues, and keeps the theme on sign-out", () => {
  const { result, setSignedIn } = renderUI();
  act(() => {
    result.current.setIncludeAdult(true);
    result.current.toggleTheme();
  });
  const theme = result.current.theme;
  setSignedIn(true);
  expect(result.current.includeAdult).toBe(true);
  setSignedIn(false);
  expect(result.current.theme).toBe(theme);
});
