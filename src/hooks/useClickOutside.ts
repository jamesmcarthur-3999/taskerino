import { useEffect, type RefObject } from 'react';

/**
 * Hook that handles clicks outside of specified elements
 * @param refs - Array of refs to track (can be different element types)
 * @param handler - Callback function to execute when clicking outside
 */
export function useClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // Check if click is outside all refs
      const isOutside = refs.every(
        (ref) => !ref.current || !ref.current.contains(target)
      );

      if (isOutside) {
        handler();
      }
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs, handler]);
}
