import { render, screen } from "@testing-library/react";
import { AuthStage } from "../AuthStage";

describe("AuthStage", () => {
  it("renders the wordmark as the page heading, the tagline, the card heading and its content", () => {
    render(
      <AuthStage title="Create Account">
        <p>form here</p>
      </AuthStage>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "CINE DB" })).toBeInTheDocument();
    expect(screen.getByText("Track what you've watched and find what to watch next.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByText("form here")).toBeInTheDocument();
  });
});
