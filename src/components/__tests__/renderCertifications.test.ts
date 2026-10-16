import { renderCertifications } from "../MovieDetails";

// load-states spec: detail pages degrade per section, down to one malformed
// country entry in the release dates part.

type Certs = Parameters<typeof renderCertifications>[0];

it("skips a country entry without a release-date list and a null entry", () => {
  const certs = [
    { iso_3166_1: "GB" },
    null,
    { iso_3166_1: "US", release_dates: [{ certification: "", type: 3 }, { certification: "R", type: 3 }] },
  ] as unknown as Certs;
  expect(renderCertifications(certs, "US")).toBe("R");
});

it("falls back to the US rating when the user's region entry is malformed", () => {
  const certs = [
    { iso_3166_1: "DE", release_dates: null },
    { iso_3166_1: "US", release_dates: [{ certification: "PG-13", type: 3 }] },
  ] as unknown as Certs;
  expect(renderCertifications(certs, "DE")).toBe("PG-13 (US)");
});

it("says not rated when no entry is usable", () => {
  const certs = [{ iso_3166_1: "US", release_dates: "oops" }] as unknown as Certs;
  expect(renderCertifications(certs, "US")).toBe("Not Rated");
});
