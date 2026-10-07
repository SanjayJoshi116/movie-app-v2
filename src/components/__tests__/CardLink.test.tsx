import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CardLink from "../CardLink";

function mountCardLink(props: Partial<React.ComponentProps<typeof CardLink>> = {}, onParentClick = jest.fn()) {
  render(
    <MemoryRouter initialEntries={["/start"]}>
      <Routes>
        <Route
          path="/start"
          element={
            <div onClick={onParentClick}>
              <CardLink to="/movie/550" label="Fight Club" {...props}>
                poster
              </CardLink>
            </div>
          }
        />
        <Route path="/movie/:id" element={<div>detail page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return screen.getByRole("link", { name: "Fight Club" });
}

describe("CardLink", () => {
  it("renders a real link with an href and the card-link class", () => {
    const link = mountCardLink();
    expect(link).toHaveAttribute("href", "/movie/550");
    expect(link).toHaveClass("card-link");
  });

  it("follows `to` on a plain click when there is no onNavigate", () => {
    fireEvent.click(mountCardLink());
    expect(screen.getByText("detail page")).toBeInTheDocument();
  });

  it("calls onNavigate instead of following the link on a plain click", () => {
    const onNavigate = jest.fn();
    const link = mountCardLink({ onNavigate });
    const notPrevented = fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
    expect(screen.queryByText("detail page")).not.toBeInTheDocument();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }])(
    "leaves modifier/middle clicks (%p) to the browser",
    (init) => {
      const onNavigate = jest.fn();
      fireEvent.click(mountCardLink({ onNavigate }), init);
      expect(onNavigate).not.toHaveBeenCalled();
    }
  );

  it("stops the click reaching a parent handler when asked", () => {
    const parent = jest.fn();
    fireEvent.click(mountCardLink({ onNavigate: jest.fn(), stopPropagation: true }, parent));
    expect(parent).not.toHaveBeenCalled();
  });

  it("lets the click bubble by default", () => {
    const parent = jest.fn();
    fireEvent.click(mountCardLink({ onNavigate: jest.fn() }, parent));
    expect(parent).toHaveBeenCalledTimes(1);
  });
});
