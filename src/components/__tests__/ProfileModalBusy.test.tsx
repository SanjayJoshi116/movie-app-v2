import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileModal from "../ProfileModal";

// fix-session-sweep-f1: Edit Profile can't be closed while a write is in flight.

const mockLibrary = { isLoading: false, error: null, hasLoaded: true };
jest.mock("../../context/AuthContext", () => ({
  AuthContext: jest.requireActual("react").createContext(null),
  useAuth: () => ({
    user: { id: 1, username: "a", email: "a@x.test", first_name: "", last_name: "", is_staff: false, avatar_url: "/media/a.jpg" },
    updateProfile: jest.fn(), setUserData: jest.fn(() => true), logout: jest.fn(),
  }),
}));
jest.mock("../../context/WatchlistContext", () => ({ useWatchlistContext: () => ({ watchlist: [], ...mockLibrary }) }));
jest.mock("../../context/WatchedContext", () => ({ useWatchedContext: () => ({ watched: [], ...mockLibrary }) }));
jest.mock("../../context/RatingsContext", () => ({ useRatingsContext: () => ({ ratings: [], ...mockLibrary }) }));
jest.mock("../../context/useListsContext", () => ({ useListsContext: () => ({ lists: [], ...mockLibrary }) }));
jest.mock("../../context/UIContext", () => ({
  UIContext: jest.requireActual("react").createContext(null),
  useUIContext: () => ({ region: "US", setRegion: jest.fn() }),
}));
jest.mock("../../hooks/useToast", () => ({ useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn() }) }));
jest.mock("../../api/tmdb", () => ({ fetchProviderRegions: () => new Promise(() => {}) }));
// The import dialogs aren't under test and need the library providers.
jest.mock("../CSVUploadModal", () => () => null);
// Stands in for a restore that starts and reports itself busy.
jest.mock("../lists/CSVImportAllModal", () => ({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) => (
  <>
    <button onClick={() => onBusyChange?.(true)}>start mock restore</button>
    <button onClick={() => onBusyChange?.(false)}>finish mock restore</button>
  </>
));

// eslint-disable-next-line no-var -- assigned from a hoisted jest.mock factory
var mockFinishRemove: (v: unknown) => void;
jest.mock("../../api/userApi", () => ({
  __esModule: true,
  default: { get: jest.fn(() => new Promise(() => {})) },
  getTMDBAuthStatus: () => Promise.resolve({ data: { connected: false } }),
  getTMDBRequestToken: jest.fn(), disconnectTMDB: jest.fn(), uploadAvatar: jest.fn(),
  removeAvatar: () => new Promise((resolve) => { mockFinishRemove = resolve; }),
  getFollowedPeople: jest.fn(), getAllEpisodeProgress: jest.fn(),
}));

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

it("holds while a photo removal is in flight, then closes normally", async () => {
  const onClose = jest.fn();
  render(<ProfileModal open onClose={onClose} />);

  // Idle, Escape closes it (so the check below can't pass by missing the target).
  fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape", code: "Escape", keyCode: 27 });
  expect(onClose).toHaveBeenCalledTimes(1);
  onClose.mockClear();

  fireEvent.click(await screen.findByRole("button", { name: /remove/i }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /close/i })).toBeNull());
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape", keyCode: 27 });
  expect(onClose).not.toHaveBeenCalled();

  await act(async () => mockFinishRemove({ data: { id: 1 } }));
  fireEvent.click(await screen.findByRole("button", { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
}, 20000); // the whole tabbed dialog renders slowly in jsdom

// fix-components-sweep-f4: Escape in a running import dialog isn't stopped
// there (its own keyboard close is off), so it reached this dialog and closed it.
it("holds while an import opened from it is running", async () => {
  const onClose = jest.fn();
  render(<ProfileModal open onClose={onClose} />);
  const dialog = await screen.findByRole("dialog");

  fireEvent.click(screen.getByRole("button", { name: "start mock restore" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /close/i })).toBeNull());
  fireEvent.keyDown(dialog, { key: "Escape", code: "Escape", keyCode: 27 });
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "finish mock restore" }));
  fireEvent.click(await screen.findByRole("button", { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
}, 20000);
