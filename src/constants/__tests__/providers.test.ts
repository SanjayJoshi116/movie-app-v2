import { PROVIDER_SEARCH_URLS } from "../providers";

// fix-shell-sweep-f5 (title-details): Prime Video (9 in the US, 119 elsewhere)
// opens Prime Video's own search, which serves the visitor's region, not the
// amazon.com US store.
it.each([9, 119])("links Prime Video id %i to its own search", (id) => {
  const url = new URL(PROVIDER_SEARCH_URLS[id]!("Fight Club"));
  expect(url.host).toBe("www.primevideo.com");
  expect(url.searchParams.get("phrase")).toBe("Fight Club");
});
