import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkWatchedModal } from "../MarkWatchedModal";
import { fetchMovieDetails } from "../../api/tmdb";

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
