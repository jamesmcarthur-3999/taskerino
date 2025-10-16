import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ColorScheme, GlassStrength } from '../design-system/theme';

interface ThemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  glassStrength: GlassStrength;
  setGlassStrength: (strength: GlassStrength) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEYS = {
  COLOR_SCHEME: 'taskerino-color-scheme',
  GLASS_STRENGTH: 'taskerino-glass-strength',
} as const;

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COLOR_SCHEME);
    return (saved as ColorScheme) || 'ocean';
  });

  const [glassStrength, setGlassStrengthState] = useState<GlassStrength>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GLASS_STRENGTH);
    return (saved as GlassStrength) || 'strong';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GLASS_STRENGTH, glassStrength);
  }, [glassStrength]);

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
  };

  const setGlassStrength = (strength: GlassStrength) => {
    setGlassStrengthState(strength);
  };

  const value: ThemeContextType = {
    colorScheme,
    setColorScheme,
    glassStrength,
    setGlassStrength,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
