import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import userApi from "../../api/userApi";
import { useLists } from "../useLists";
import { AuthContext } from "../../context/AuthContext";
import type { WatchlistInput } from "../../types";

jest.mock("../../api/userApi", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

const mockGet = userApi.get as jest.Mock;
const mockPost = userApi.post as jest.Mock;
const mockDelete = userApi.delete as jest.Mock;
const mockPatch = userApi.patch as jest.Mock;

const mockAuthValue = {
  user: { id: 1, username: "testuser", email: "t@t.com", first_name: "", last_name: "", is_staff: false, avatar_url: null },
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
  setUserData: jest.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthContext.Provider, { value: mockAuthValue }, children);


const entry: WatchlistInput = { id: 1, type: "movie", title: "Test", posterPath: null, voteAverage: 7 };
const listDTO = { id: 5, name: "Faves", description: "", createdAt: "2024-01-01T00:00:00Z", items: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ data: [listDTO] });
  mockPost.mockResolvedValue({ data: { id: 77, addedAt: "2024-01-01T00:00:00Z" } });
  mockDelete.mockResolvedValue({});
  mockPatch.mockResolvedValue({});
});

describe("useLists", () => {
  it("reports loading on the first render", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLists(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("records an error when the initial load fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.lists).toHaveLength(0);
  });

  it("double add to the same list sends one POST", async () => {
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.lists).toHaveLength(1));

    await act(async () => {
      await Promise.all([result.current.addToList(5, entry), result.current.addToList(5, entry)]);
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.isInList(5, 1, "movie")).toBe(true);
  });

  it("double delete of a list sends one DELETE", async () => {
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.lists).toHaveLength(1));

    await act(async () => {
      await Promise.all([result.current.deleteList(5), result.current.deleteList(5)]);
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result.current.lists).toHaveLength(0);
  });

  it("a double create with the same name sends one POST and makes one list", async () => {
    let release!: () => void;
    mockPost.mockImplementation((url: string) =>
      url === "/lists/"
        ? new Promise((resolve) => { release = () => resolve({ data: { ...listDTO, id: 9, name: "Horror" } }); })
        : Promise.resolve({ data: {} })
    );
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = result.current.createList("Horror", "");
      b = result.current.createList(" horror ", "");
    });
    await act(async () => { release(); await Promise.all([a, b]); });
    expect(mockPost.mock.calls.filter(([url]) => url === "/lists/")).toHaveLength(1);
    expect(result.current.lists.filter((l) => l.name === "Horror")).toHaveLength(1);
  });

  it("creates with different names are independent", async () => {
    mockPost.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      void result.current.createList("Horror", "");
      void result.current.createList("Comedy", "");
    });
    expect(mockPost.mock.calls.filter(([url]) => url === "/lists/")).toHaveLength(2);
  });

  it("a double update sends one PATCH", async () => {
    let release!: () => void;
    mockPatch.mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ data: { ...listDTO, name: "Renamed" } }); })
    );
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = result.current.updateList(5, { name: "Renamed" });
      b = result.current.updateList(5, { name: "Renamed" });
    });
    await act(async () => { release(); await Promise.all([a, b]); });
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(result.current.lists[0]!.name).toBe("Renamed");
  });
});
