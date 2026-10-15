import type React from "react";
import { render, screen } from "@testing-library/react";
import { WatchProviders } from "../WatchProviders";
import type { TMDBProviderRegion } from "../../types";
import { UIContext } from "../../context/UIContext";

type UIContextValue = NonNullable<React.ContextType<typeof UIContext>>;

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

// title-details spec: the user's region decides where-to-watch data.
describe("region", () => {
  const svc = (id: number, name: string) => ({ provider_id: id, provider_name: name, logo_path: "/x.png" });
  const providers: Record<string, TMDBProviderRegion> = {
    US: { flatrate: [svc(900001, "US Service")] } as TMDBProviderRegion,
    IN: { flatrate: [svc(900002, "Indian Service")] } as TMDBProviderRegion,
  };

  function renderIn(region: string, data = providers) {
    render(
      <UIContext.Provider value={{ region } as unknown as UIContextValue}>
        <WatchProviders providers={data} title="Fight Club" />
      </UIContext.Provider>,
    );
  }

  it("shows the user's region and names it", () => {
    renderIn("IN");
    expect(screen.getByAltText("Indian Service")).toBeInTheDocument();
    expect(screen.queryByAltText("US Service")).not.toBeInTheDocument();
    expect(screen.getByText("Region: India")).toBeInTheDocument();
  });

  it("falls back to the US, saying so", () => {
    renderIn("DE");
    expect(screen.getByAltText("US Service")).toBeInTheDocument();
    expect(screen.getByText(/Showing United States availability: nothing listed for Germany/)).toBeInTheDocument();
  });

  it("says nothing is available, naming the user's region", () => {
    renderIn("DE", {});
    expect(screen.getByText("Not available to stream, rent or buy in your region (Germany).")).toBeInTheDocument();
  });
});
