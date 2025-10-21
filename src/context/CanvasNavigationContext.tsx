/**
 * CanvasNavigationContext
 *
 * Provides navigation functionality for Canvas components to jump to source data
 * in the Review tab. This allows citations to be clickable and navigate users
 * to the exact moment in the session timeline.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { SourceCitation } from '../types';

interface CanvasNavigationContextValue {
  navigateToSource: (citation: SourceCitation) => void;
}

const CanvasNavigationContext = createContext<CanvasNavigationContextValue | null>(null);

interface CanvasNavigationProviderProps {
  children: ReactNode;
  onNavigateToSource: (citation: SourceCitation) => void;
}

export function CanvasNavigationProvider({
  children,
  onNavigateToSource,
}: CanvasNavigationProviderProps) {
  const value: CanvasNavigationContextValue = {
    navigateToSource: onNavigateToSource,
  };

  return (
    <CanvasNavigationContext.Provider value={value}>
      {children}
    </CanvasNavigationContext.Provider>
  );
}

/**
 * Hook to access canvas navigation functionality
 *
 * @throws {Error} If used outside of CanvasNavigationProvider
 */
export function useCanvasNavigation(): CanvasNavigationContextValue {
  const context = useContext(CanvasNavigationContext);

  if (!context) {
    throw new Error('useCanvasNavigation must be used within a CanvasNavigationProvider');
  }

  return context;
}
