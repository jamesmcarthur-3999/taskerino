import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MenuPortalProps {
  children: ReactNode;
}

/**
 * MenuPortal - Renders zone menu content into TopNavigation's grid layout
 *
 * Uses React Portal to render children into the #menu-portal-target element
 * in TopNavigation's CSS Grid, ensuring zone menus are always positioned
 * correctly relative to the logo without JavaScript measurements.
 *
 * Handles mount timing gracefully - waits for portal target to be available.
 */
export function MenuPortal({ children }: MenuPortalProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Find the portal target element in TopNavigation
    const target = document.getElementById('menu-portal-target');

    if (target) {
      setPortalTarget(target);
    } else {
      // Portal target doesn't exist yet (TopNavigation not mounted)
      // This can happen during initial app load
      console.warn('[MenuPortal] Portal target #menu-portal-target not found. TopNavigation may not be mounted yet.');
    }

    // Cleanup on unmount
    return () => {
      setPortalTarget(null);
    };
  }, []);

  // If portal target isn't available, don't render anything
  // This prevents menus from rendering in wrong location during mount
  if (!portalTarget) {
    return null;
  }

  // Portal children into TopNavigation's menu column
  return createPortal(children, portalTarget);
}
