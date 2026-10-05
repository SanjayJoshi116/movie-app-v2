import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useLocalStorage } from "./useLocalStorage";

const MAX_RECENT = 5;

export function useRecentSearches() {
  const [recents, setRecents] = useLocalStorage<string[]>("cinedb_recent_searches", []);

  // clearSession() removes the stored key on logout, but SearchBox is always
  // mounted and keeps its in-memory copy — drop it too, so the next account in
  // this tab doesn't see the previous one's searches. Only on a signed-in ->
  // signed-out transition: user is also null while auth is still loading.
  const user = useContext(AuthContext)?.user ?? null;
  const hadUser = useRef(user !== null);
  useEffect(() => {
    if (user === null && hadUser.current) setRecents([]);
    hadUser.current = user !== null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
