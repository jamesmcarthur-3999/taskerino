/**
 * animations.ts - Animation Utilities
 *
 * Scroll-based animation calculations for TopNavigation logo/menu morph.
 * Extracted from TopNavigation.tsx lines 53-85.
 */

import { easeOutElasticLight, easeOutQuart, clamp } from '../../utils/easing';
import { NAV_CONSTANTS } from './constants';

/**
 * Logo morph animation values
 */
export interface LogoMorphValues {
  opacity: number;
  scale: number;
  blur: number;
  pointerEvents: 'auto' | 'none';
}

/**
 * Menu reveal animation values
 */
export interface MenuRevealValues {
  opacity: number;
  scale: number;
  pointerEvents: 'auto' | 'none';
}

/**
 * Calculate logo morph values based on scroll position
 *
 * Fades out and shrinks the logo as user scrolls down.
 * Uses smooth ease-out for natural disappearance.
 *
 * Animation range: 50px - 300px scroll
 * - Opacity: 1 → 0 (with ease-out)
 * - Scale: 1 → 0.75 (subtle shrink)
 * - Blur: 0 → 4px (polish effect)
 * - Pointer events: Disabled when opacity < 0.3
 *
 * @param scrollY - Current scroll Y position
 * @returns Logo animation values
 */
export function calculateLogoMorph(scrollY: number): LogoMorphValues {
  // Delay start to 50px for less eager fade
  const logoStartProgress = clamp(
    (scrollY - NAV_CONSTANTS.LOGO_FADE_START) /
    (NAV_CONSTANTS.LOGO_FADE_END - NAV_CONSTANTS.LOGO_FADE_START),
    0,
    1
  );

  // Use smooth ease-out for natural disappearance
  const logoProgress = easeOutQuart(logoStartProgress);

  const opacity = 1 - logoProgress;
  const scale = 1 - (logoProgress * 0.25); // Subtle shrink
  const blur = logoProgress * 4; // Add slight blur for polish
  const pointerEvents: 'auto' | 'none' = opacity < 0.3 ? 'none' : 'auto';

  return {
    opacity,
    scale,
    blur,
    pointerEvents,
  };
}

/**
 * Calculate menu reveal values based on scroll position
 *
 * Reveals the menu button with elastic bounce effect.
 * Delayed until logo is well into fade (150px scroll).
 *
 * Animation range: 150px - 300px scroll
 * - Opacity: 0 → 1 (linear)
 * - Scale: 0.6 → 1 (elastic bounce)
 * - Pointer events: Enabled when opacity > 0.7
 *
 * @param scrollY - Current scroll Y position
 * @returns Menu animation values
 */
export function calculateMenuReveal(scrollY: number): MenuRevealValues {
  // Delay start until logo is well into fade (150px scroll)
  const menuStartProgress = clamp(
    (scrollY - NAV_CONSTANTS.MENU_REVEAL_START) /
    (NAV_CONSTANTS.MENU_FADE_END - NAV_CONSTANTS.MENU_REVEAL_START),
    0,
    1
  );

  // Use elastic easing for playful entrance
  const menuProgress = easeOutElasticLight(menuStartProgress);

  const opacity = menuStartProgress; // Linear opacity for clean fade-in
  const scale = 0.6 + (menuProgress * 0.4); // Elastic bounce to full size
  const pointerEvents: 'auto' | 'none' = opacity > 0.7 ? 'auto' : 'none';

  return {
    opacity,
    scale,
    pointerEvents,
  };
}
