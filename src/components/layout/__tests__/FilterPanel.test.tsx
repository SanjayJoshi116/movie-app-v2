import { fireEvent, render, screen } from "@testing-library/react";
import { FilterPanel } from "../FilterPanel";

// browse-filters: the panel's genre picks are only ever the browsed type's.

const mockSetGenres = jest.fn();
const mockSetIncludeAdult = jest.fn();
let mockSelectedGenres: number[] = [];
jest.mock("../../../context/useAppContext", () => ({
  useAppContext: () => ({
    selectedGenres: mockSelectedGenres,
    setGenres: mockSetGenres,
    clearGenres: () => undefined,
    includeAdult: false,
    setIncludeAdult: mockSetIncludeAdult,
  }),
}));

jest.setTimeout(20_000);

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

const ACTION_MOVIE_ONLY = 28; // TV uses 10759 "Action & Adventure"
const COMEDY_BOTH = 35;

beforeEach(() => jest.clearAllMocks());

function renderPanel(isMovie: boolean, onApply: (...args: unknown[]) => void = () => undefined, open = true) {
  const ui = (o: boolean) => (
    <FilterPanel
      open={o}
      onClose={() => undefined}
      isMovie={isMovie}
      appliedFilters={null}
      appliedSortBy="popularity.desc"
      onApply={onApply}
      onReset={() => undefined}
    />
  );
  const view = render(ui(open));
  return { ...view, setOpen: (o: boolean) => view.rerender(ui(o)) };
}

it("opening for TV with a movie-only genre applied seeds no genre, and Apply sends none", async () => {
  mockSelectedGenres = [ACTION_MOVIE_ONLY];
  renderPanel(false);
  fireEvent.click(await screen.findByRole("button", { name: /apply/i }));
  expect(mockSetGenres).toHaveBeenCalledWith([]);
});

it("keeps a genre both types share", async () => {
  mockSelectedGenres = [ACTION_MOVIE_ONLY, COMEDY_BOTH];
  renderPanel(false);
  await screen.findByText("Comedy");
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
  expect(mockSetGenres).toHaveBeenCalledWith([COMEDY_BOTH]);
});

it("the adult switch is a draft: closing without Apply changes nothing", async () => {
  mockSelectedGenres = [];
  const { setOpen } = renderPanel(true);
  const sw = await screen.findByRole("switch", { name: "Include Adult Content" });
  fireEvent.click(sw);
  expect(sw).toBeChecked();
  expect(mockSetIncludeAdult).not.toHaveBeenCalled();
  setOpen(false);
  setOpen(true);
  expect(screen.getByRole("switch", { name: "Include Adult Content" })).not.toBeChecked();
});

it("Apply sends the adult setting together with the other filters", async () => {
  mockSelectedGenres = [];
  const onApply = jest.fn();
  renderPanel(true, onApply);
  fireEvent.click(await screen.findByRole("switch", { name: "Include Adult Content" }));
  fireEvent.change(screen.getByLabelText("Min TMDB Rating (0–10)"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
  expect(mockSetIncludeAdult).toHaveBeenCalledWith(true);
  expect(onApply).toHaveBeenCalledTimes(1);
  expect(onApply.mock.calls[0][0]).toMatchObject({ includeAdult: true, minRating: "7" });
});

it("labels every field and swaps a backwards year range on Apply", async () => {
  mockSelectedGenres = [];
  const onApply = jest.fn();
  renderPanel(true, onApply);
  for (const label of ["From", "To", "Min TMDB Rating (0–10)", "Language", "Min", "Max", "Sort By"]) {
    expect(await screen.findByLabelText(label)).toBeInTheDocument();
  }
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2020" } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "1990" } });
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
  expect(onApply.mock.calls[0][0]).toMatchObject({ yearFrom: "1990", yearTo: "2020" });
});
