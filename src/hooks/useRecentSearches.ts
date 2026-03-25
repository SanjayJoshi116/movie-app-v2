import { useLocalStorage } from "./useLocalStorage";

const MAX_RECENT = 5;

export function useRecentSearches() {
  const [recents, setRecents] = useLocalStorage<string[]>("cinedb_recent_searches", []);

  const addRecent = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecents((prev) => {
      const filtered = prev.filter((s) => s !== trimmed);
      return [trimmed, ...filtered].slice(0, MAX_RECENT);
    });
  };

  const clearRecents = () => setRecents([]);

  return { recents, addRecent, clearRecents };
}
