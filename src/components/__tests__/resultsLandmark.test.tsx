import { render, screen } from "@testing-library/react";
import Movies from "../Movies";
import TVShows from "../TVShows";
import type { TMDBMovieSummary, TMDBTVSummary } from "../../types";

// fix-components-sweep-f4 (accessibility): App's layout already renders the
// page's one <main>; the grids used to add a second, nested one.

jest.mock("../MediaCard", () => () => null);

beforeAll(() => {
  // antd's Row reads it; jsdom doesn't have it.
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});

it.each([
  ["Movie results", () => <Movies movies={[{ id: 550 } as TMDBMovieSummary]} onKnowMore={jest.fn()} />],
  ["TV show results", () => <TVShows tvShows={[{ id: 1396 } as TMDBTVSummary]} onKnowMore={jest.fn()} />],
])("names the %s region without adding a main landmark", (name, grid) => {
  render(<main>{grid()}</main>);
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getByRole("region", { name })).toBeInTheDocument();
});
