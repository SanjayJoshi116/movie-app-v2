import { render, screen } from "@testing-library/react";
import { WatchProviders } from "../WatchProviders";
import type { TMDBProviderRegion } from "../../types";

// A provider with no search URL of its own falls back to TMDB's region link.
const UNKNOWN_PROVIDER = { provider_id: 999999, provider_name: "Some Service", logo_path: "/s.png" };

const region = (link: string): Record<string, TMDBProviderRegion> => ({
  US: { link, flatrate: [UNKNOWN_PROVIDER] } as TMDBProviderRegion,
});

it("links a provider through TMDB's https link", () => {
  render(<WatchProviders providers={region("https://www.themoviedb.org/movie/550/watch")} title="Fight Club" />);
  expect(screen.getByRole("link", { name: "Some Service" })).toHaveAttribute(
    "href", "https://www.themoviedb.org/movie/550/watch",
  );
});

it("never turns a non-web link into an href (untrusted-content)", () => {
  // eslint-disable-next-line no-script-url
  render(<WatchProviders providers={region("javascript:alert(1)")} title="Fight Club" />);
  expect(screen.getByAltText("Some Service")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
