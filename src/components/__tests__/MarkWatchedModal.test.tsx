import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkWatchedModal } from "../MarkWatchedModal";
import { fetchMovieDetails } from "../../api/tmdb";
import type { ContextType } from "react";
import { UIContext } from "../../context/UIContext";

// mark-watched spec: the dialog holds while saving and survives a failed save.
jest.mock("../../api/tmdb", () => ({ __esModule: true, fetchMovieDetails: jest.fn(), fetchTVDetails: jest.fn() }));

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

beforeEach(() => {
  (fetchMovieDetails as jest.Mock).mockResolvedValue({ data: { runtime: 139, release_date: "1999-10-15", original_language: "en" } });
});

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function openDialog(onConfirm: jest.Mock, onCancel = jest.fn()) {
  render(<MarkWatchedModal open mediaId={550} mediaType="movie" onCancel={onCancel} onConfirm={onConfirm} />);
  const runtime = await screen.findByLabelText("Runtime (minutes)");
  await waitFor(() => expect(runtime).toHaveValue("139"));
  return { runtime, onCancel };
}

const okButton = () => screen.getByRole("button", { name: /Mark Watched/ });

it("can't be closed and doesn't save twice while saving", async () => {
  const save = deferred();
  const onConfirm = jest.fn(() => save.promise);
  const { onCancel } = await openDialog(onConfirm);

  fireEvent.click(okButton());
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  fireEvent.click(okButton());
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onCancel).not.toHaveBeenCalled();
  expect(onConfirm).toHaveBeenCalledTimes(1);

  await act(async () => { save.resolve(); await save.promise; });
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});

it("a failed save keeps the dialog open with what was entered", async () => {
  const save = deferred();
  const onConfirm = jest.fn(() => save.promise);
  const { runtime } = await openDialog(onConfirm);
  fireEvent.change(runtime, { target: { value: "150" } });

  fireEvent.click(okButton());
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ runtimeMinutes: 150 })));
  await act(async () => { save.reject(new Error("500")); await save.promise.catch(() => {}); });

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("Runtime (minutes)")).toHaveValue("150");
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});

it("a region change keeps the entered runtime and re-picks only the platforms", async () => {
  (fetchMovieDetails as jest.Mock).mockClear().mockResolvedValue({
    data: {
      runtime: 139,
      "watch/providers": { results: {
        US: { flatrate: [{ provider_name: "Netflix" }] },
        IN: { flatrate: [{ provider_name: "Hotstar" }] },
      } },
    },
  });
  const dialog = (region: string) => (
    <UIContext.Provider value={{ region } as unknown as ContextType<typeof UIContext>}>
      <MarkWatchedModal open mediaId={550} mediaType="movie" onCancel={jest.fn()} onConfirm={jest.fn()} />
    </UIContext.Provider>
  );
  const { rerender } = render(dialog("US"));
  const runtime = await screen.findByLabelText("Runtime (minutes)");
  await waitFor(() => expect(runtime).toHaveValue("139"));
  fireEvent.change(runtime, { target: { value: "95" } });

  rerender(dialog("IN"));
  fireEvent.mouseDown(screen.getByLabelText("Watched on (optional)"));
  expect(await screen.findByTitle("Hotstar")).toBeInTheDocument();
  expect(screen.queryByTitle("Netflix")).toBeNull();
  expect(runtime).toHaveValue("95");
  expect(fetchMovieDetails).toHaveBeenCalledTimes(1);
});
