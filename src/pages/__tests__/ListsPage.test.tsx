import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useListsContext } from "../../context/useListsContext";
import type { UserList } from "../../types";
import ListsPage from "../ListsPage";

jest.mock("../../context/useListsContext", () => ({ useListsContext: jest.fn() }));
jest.mock("../../components/lists/CSVListImportModal", () => () => null);
jest.mock("../../hooks/useToast", () => {
  const toast = { showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn(), showWarning: jest.fn() };
  return { useToast: () => toast };
});

const mockLists = useListsContext as jest.Mock;

// antd's confirm popup animates in: these take seconds under a full parallel run.
jest.setTimeout(20_000);

const list: UserList = { id: 1, name: "Favorites", description: "", items: [], createdAt: "2026-10-01T10:00:00Z" } as unknown as UserList;
const state = (over: Partial<ReturnType<typeof useListsContext>> = {}) => ({
  lists: [list], isLoading: false, error: null, reloadLists: jest.fn(), createList: jest.fn(), deleteList: jest.fn().mockResolvedValue(undefined),
  ...over,
});

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/lists"]}>
      <Routes>
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:id" element={<div>List detail page</div>} />
      </Routes>
    </MemoryRouter>,
  );

it("keeps the cards during a background reload", () => {
  mockLists.mockReturnValue(state({ isLoading: true }));
  renderPage();
  expect(screen.getByText("Favorites")).toBeInTheDocument();
});

it("shows neither cards nor the empty state while nothing is loaded", () => {
  mockLists.mockReturnValue(state({ lists: [], isLoading: true }));
  renderPage();
  expect(screen.queryByText("Favorites")).toBeNull();
  expect(screen.queryByText(/No custom lists yet/)).toBeNull();
});

it("Cancel in the delete confirm doesn't open the list", async () => {
  const s = state();
  mockLists.mockReturnValue(s);
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  fireEvent.click(cancel);
  expect(screen.queryByText("List detail page")).toBeNull();
  expect(s.deleteList).not.toHaveBeenCalled();
});

it("confirming the delete deletes without opening the list", async () => {
  const s = state();
  mockLists.mockReturnValue(s);
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
  const buttons = await screen.findAllByRole("button", { name: /Delete/ });
  fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
  await waitFor(() => expect(s.deleteList).toHaveBeenCalledWith(1));
  expect(screen.queryByText("List detail page")).toBeNull();
});
