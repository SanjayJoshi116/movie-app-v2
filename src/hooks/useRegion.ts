import { useContext } from "react";
import { UIContext } from "../context/UIContext";
import { FALLBACK_REGION } from "../utils/region";

/** The user's region for where-to-watch data (US outside a UIProvider, e.g. in tests). */
export function useRegion(): string {
  return useContext(UIContext)?.region ?? FALLBACK_REGION;
}
