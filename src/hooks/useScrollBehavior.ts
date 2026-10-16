import { useReducedMotion } from "framer-motion";

/** `behavior` for a programmatic scroll: instant under reduced motion. An
 *  explicit JS `behavior: "smooth"` beats the CSS reduced-motion rule, so
 *  every smooth scroll reads it from here. */
export function useScrollBehavior(): ScrollBehavior {
  return useReducedMotion() ? "auto" : "smooth";
}
