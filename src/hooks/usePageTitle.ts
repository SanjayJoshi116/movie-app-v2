import { useEffect } from "react";

export const APP_NAME = "CINE DB";

/** What a page reported: its title (and whether it's still loading the real
 *  one), or `null` when the page that set it unmounted. */
export type PageTitleEvent = { title: string; loading: boolean } | null;

type Listener = (event: PageTitleEvent) => void;
const listeners = new Set<Listener>();

/** Subscribe to document-title changes made through usePageTitle (RouteAnnouncer). */
export function subscribePageTitle(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function pageTitle(name?: string | null): string {
  return name ? `${name} · ${APP_NAME}` : APP_NAME;
}

/** NotFoundPage's title, also used by a detail page whose id isn't valid. */
export const NOT_FOUND_PAGE_TITLE = "Page Not Found";

/** The headings a detail or person page shows when it can't show its subject. */
export interface DetailHeadings {
  /** Shown while loading (with `loading` true). */
  generic: string;
  notFound: string;
  failed: string;
}

/**
 * usePageTitle's arguments for a detail or person page, named after what the
 * page shows in each state. The page owns the title even while it renders
 * NotFoundPage: React runs the parent's effect after the child's, so a
 * different parent title would win.
 */
export function detailPageTitle(
  state: { validId: boolean; loading: boolean; error: "not-found" | "failed" | null; name?: string | null },
  headings: DetailHeadings,
): [string, { loading: boolean }] {
  if (!state.validId) return [NOT_FOUND_PAGE_TITLE, { loading: false }];
  if (state.loading) return [headings.generic, { loading: true }];
  if (state.error === "not-found") return [headings.notFound, { loading: false }];
  if (state.error) return [headings.failed, { loading: false }];
  // A record TMDB gave no name still loaded: keep the generic title.
  return [state.name || headings.generic, { loading: false }];
}

/**
 * Sets the tab title to "<name> · CINE DB" while the page is mounted
 * (accessibility spec: each page has its own title). Pages with a loaded
 * name (movie, TV, person, list) pass a generic one until it arrives, with
 * `loading` true meanwhile so the route announcer waits for the real name.
 * Pass `loading: false` once the load settles either way: a failed load's
 * generic title is then final and gets announced.
 */
export function usePageTitle(name?: string | null, { loading = false }: { loading?: boolean } = {}): void {
  const title = pageTitle(name);
  useEffect(() => {
    document.title = title;
    listeners.forEach((l) => l({ title, loading }));
  }, [title, loading]);
  useEffect(() => () => {
    document.title = APP_NAME;
    listeners.forEach((l) => l(null));
  }, []);
}
