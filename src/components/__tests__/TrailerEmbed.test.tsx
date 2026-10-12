import { render, screen, fireEvent, within } from "@testing-library/react";
import { TrailerEmbed } from "../TrailerEmbed";

test("shows only a named thumbnail button until played", () => {
  render(<TrailerEmbed videoKey="abc123" name="Official Trailer" />);
  expect(screen.queryByTitle("Official Trailer")).toBeNull();
  const button = screen.getByRole("button", { name: "Play trailer: Official Trailer" });
  expect(within(button).getByRole("presentation")).toHaveAttribute(
    "src", "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
  );
});

test("activating it loads the player, autoplaying", () => {
  render(<TrailerEmbed videoKey="abc123" name="Official Trailer" />);
  fireEvent.click(screen.getByRole("button", { name: /play trailer/i }));
  expect(screen.getByTitle("Official Trailer")).toHaveAttribute(
    "src", "https://www.youtube-nocookie.com/embed/abc123?autoplay=1",
  );
  expect(screen.queryByRole("button", { name: /play trailer/i })).toBeNull();
});
