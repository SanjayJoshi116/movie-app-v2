import { useEffect } from "react";

export const APP_NAME = "CINE DB";

type Listener = (title: string) => void;
const listeners = new Set<Listener>();

/** Subscribe to document-title changes made through usePageTitle (RouteAnnouncer). */
export function subscribePageTitle(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function pageTitle(name?: string | null): string {
  return name ? `${name} · ${APP_NAME}` : APP_NAME;
}

/**
 * Sets the tab title to "<name> · CINE DB" while the page is mounted
 * (accessibility spec: each page has its own title). Pages with a loaded
 * name (movie, TV, person) pass a generic one until it arrives.
 */
export function usePageTitle(name?: string | null): void {
  const title = pageTitle(name);
  useEffect(() => {
    document.title = title;
    listeners.forEach((l) => l(title));
  }, [title]);
  useEffect(() => () => { document.title = APP_NAME; }, []);
}
