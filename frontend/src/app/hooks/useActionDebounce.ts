import { useCallback, useRef } from 'react';

/**
 * Hook to debounce rapid action clicks
 * Prevents multiple simultaneous API calls
 */
export const useActionDebounce = (delayMs: number = 1500) => {
  const lastActionTimeRef = useRef<number>(0);
  const isActionInProgressRef = useRef<boolean>(false);

  const canExecuteAction = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimeRef.current;
    
    if (isActionInProgressRef.current || timeSinceLastAction < delayMs) {
      return false;
    }
    
    lastActionTimeRef.current = now;
    isActionInProgressRef.current = true;
    return true;
  }, [delayMs]);

  const completeAction = useCallback(() => {
    isActionInProgressRef.current = false;
  }, []);

  return { canExecuteAction, completeAction };
};
