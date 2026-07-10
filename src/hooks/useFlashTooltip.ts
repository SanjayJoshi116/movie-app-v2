import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_FLASH_DURATION_MS = 1400;

export function useFlashTooltip(durationMs: number = DEFAULT_FLASH_DURATION_MS) {
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const triggerFlash = useCallback((key: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFlashKey(key);
    timeoutRef.current = setTimeout(() => setFlashKey(null), durationMs);
  }, [durationMs]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return [flashKey, triggerFlash] as const;
}
