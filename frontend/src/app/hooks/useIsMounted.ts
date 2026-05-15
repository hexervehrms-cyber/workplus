import { useEffect, useRef } from 'react';

/** Returns a ref that stays true while the component is mounted. */
export function useIsMounted(): { readonly current: boolean } {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
