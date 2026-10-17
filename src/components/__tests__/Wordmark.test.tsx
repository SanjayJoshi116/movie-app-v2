import { render, screen } from "@testing-library/react";
import { Wordmark } from "../Wordmark";
import { FONT_SIZE } from "../../constants/typography";

describe("Wordmark", () => {
  it("renders the app name as a level-1 heading by default, at the heading's own size", () => {
    render(<Wordmark />);
    const heading = screen.getByRole("heading", { level: 1, name: "CINE DB" });
    expect(heading).toHaveClass("wordmark");
    expect(heading.style.fontSize).toBe("");
  });

  it("takes a level, a size and an extra class", () => {
    render(<Wordmark level={3} size="emphasis" className="extra" />);
    const heading = screen.getByRole("heading", { level: 3, name: "CINE DB" });
    expect(heading).toHaveClass("wordmark", "extra");
    expect(heading).toHaveStyle({ fontSize: `${FONT_SIZE.emphasis}px` });
  });
});
