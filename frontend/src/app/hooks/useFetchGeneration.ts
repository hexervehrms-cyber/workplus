import { useCallback, useRef } from 'react';

/**
 * Ignore stale async responses when filters/socket events trigger overlapping fetches.
 */
export function useFetchGeneration() {
  const generationRef = useRef(0);

  const nextGeneration = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const isStale = useCallback((gen: number) => generationRef.current !== gen, []);

  return { nextGeneration, isStale, generationRef };
}
