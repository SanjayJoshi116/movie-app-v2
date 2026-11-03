import { act, fireEvent, render, screen } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import MarqueeTitle from "../MarqueeTitle";

// accessibility spec: a cut card title shows an ellipsis and keeps its full
// text as the tooltip; it scrolls on hover only when motion is allowed.
jest.mock("framer-motion", () => ({ ...jest.requireActual("framer-motion"), useReducedMotion: jest.fn() }));

const TITLE = "The Lord of the Rings: The Return of the King";

function stubWidths(text: number, box: number) {
  const scroll = jest.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(text);
  const offset = jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(box);
  return () => { scroll.mockRestore(); offset.mockRestore(); };
}

it("marks a cut title with an ellipsis and keeps the full title as its tooltip", () => {
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  const restore = stubWidths(400, 150);
  render(<MarqueeTitle>{TITLE}</MarqueeTitle>);
  expect(screen.getByTitle(TITLE)).toBeInTheDocument();
  expect(screen.getByTestId("marquee-text")).toHaveStyle({ textOverflow: "ellipsis" });
  restore();
});

it("a title that fits has no tooltip", () => {
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  const restore = stubWidths(100, 150);
  render(<MarqueeTitle>Dune</MarqueeTitle>);
  expect(screen.queryByTitle("Dune")).not.toBeInTheDocument();
  restore();
});

it("scrolls on hover when motion is allowed", () => {
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  const restore = stubWidths(400, 150);
  render(<MarqueeTitle>{TITLE}</MarqueeTitle>);
  fireEvent.mouseEnter(screen.getByTitle(TITLE));
  expect(screen.getByTestId("marquee-text")).toHaveStyle({ transform: "translateX(-250px)" });
  restore();
});

it("doesn't scroll under reduced motion", () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  const restore = stubWidths(400, 150);
  render(<MarqueeTitle>{TITLE}</MarqueeTitle>);
  fireEvent.mouseEnter(screen.getByTitle(TITLE));
  expect(screen.getByTestId("marquee-text")).toHaveStyle({ transform: "translateX(0)" });
  restore();
});

// fix-components-sweep-f4: Poppins can swap in after the first measure without
// resizing the box, so the overflow is measured again once fonts are ready.
it("measures again once the web font has loaded", async () => {
  let fontsLoaded: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => { fontsLoaded = resolve; });
  const saved = Object.getOwnPropertyDescriptor(document, "fonts");
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready } });
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  let restore = stubWidths(100, 200); // fits in the fallback font
  try {
    render(<MarqueeTitle>{TITLE}</MarqueeTitle>);
    expect(screen.queryByTitle(TITLE)).not.toBeInTheDocument();
    restore();
    restore = stubWidths(300, 200); // overflows in Poppins
    await act(async () => { fontsLoaded(); await ready; });
    expect(screen.getByTitle(TITLE)).toBeInTheDocument();
  } finally {
    restore();
    if (saved) Object.defineProperty(document, "fonts", saved);
    else delete (document as unknown as { fonts?: unknown }).fonts;
  }
});
