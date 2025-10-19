/**
 * Menu Morph Animation System
 *
 * Comprehensive animation system for morphing a menu bar between three states:
 * 1. Inline full menu (in document flow)
 * 2. Compact button (fixed position, top-left)
 * 3. Overlay menu (fixed position, expanded from button)
 *
 * Features GPU-accelerated animations, reduced motion support, and smooth
 * scroll-based transformations using Framer Motion layout animations.
 *
 * @example Basic Usage
 * ```tsx
 * import { motion, useScroll, useTransform } from 'framer-motion';
 * import {
 *   menuMorphVariants,
 *   menuContentVariants,
 *   buttonContentVariants,
 *   getMorphState,
 *   getLayoutId,
 * } from '@/animations';
 *
 * function MorphingMenu() {
 *   const [isOverlayOpen, setIsOverlayOpen] = useState(false);
 *   const { scrollY } = useScroll();
 *   const [morphState, setMorphState] = useState<MorphState>('inline');
 *
 *   useEffect(() => {
 *     return scrollY.on('change', (latest) => {
 *       setMorphState(getMorphState(latest, isOverlayOpen));
 *     });
 *   }, [scrollY, isOverlayOpen]);
 *
 *   return (
 *     <motion.nav
 *       layoutId={getLayoutId('main-menu')}
 *       variants={menuMorphVariants}
 *       animate={morphState}
 *       style={{ /* your styles *\/ }}
 *     >
 *       {/\* Menu content *\/}
 *       <motion.div variants={menuContentVariants}>
 *         <MenuItem>Home</MenuItem>
 *         <MenuItem>About</MenuItem>
 *       </motion.div>
 *
 *       {/\* Button content *\/}
 *       <motion.button
 *         variants={buttonContentVariants}
 *         onClick={() => setIsOverlayOpen(!isOverlayOpen)}
 *       >
 *         ☰
 *       </motion.button>
 *     </motion.nav>
 *   );
 * }
 * ```
 *
 * @example Using Scroll Interpolation
 * ```tsx
 * import { useScroll, useTransform } from 'framer-motion';
 * import { borderRadiusMap, menuContentOpacityMap } from '@/animations';
 *
 * function ScrollMenu() {
 *   const { scrollY } = useScroll();
 *   const borderRadius = useTransform(scrollY, borderRadiusMap.input, borderRadiusMap.output);
 *   const menuOpacity = useTransform(scrollY, menuContentOpacityMap.input, menuContentOpacityMap.output);
 *
 *   return (
 *     <motion.nav style={{ borderRadius }}>
 *       <motion.div style={{ opacity: menuOpacity }}>
 *         {/\* Menu items *\/}
 *       </motion.div>
 *     </motion.nav>
 *   );
 * }
 * ```
 *
 * @example With Overlay Backdrop
 * ```tsx
 * import { AnimatePresence } from 'framer-motion';
 * import { overlayBackdropVariants, overlayContainerVariants } from '@/animations';
 *
 * function MenuWithOverlay() {
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Open Menu</button>
 *
 *       <AnimatePresence>
 *         {isOpen && (
 *           <>
 *             {/\* Backdrop *\/}
 *             <motion.div
 *               variants={overlayBackdropVariants}
 *               initial="hidden"
 *               animate="visible"
 *               exit="hidden"
 *               onClick={() => setIsOpen(false)}
 *             />
 *
 *             {/\* Overlay menu *\/}
 *             <motion.div
 *               variants={overlayContainerVariants}
 *               initial="hidden"
 *               animate="visible"
 *               exit="hidden"
 *             >
 *               {/\* Menu content *\/}
 *             </motion.div>
 *           </>
 *         )}
 *       </AnimatePresence>
 *     </>
 *   );
 * }
 * ```
 */

import type { Variants } from 'framer-motion';
import type { SpringConfig } from './types';
import { durations, easings, opacities } from './tokens';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Menu morph states
 */
export type MorphState = 'inline' | 'compact' | 'overlay';

/**
 * Scroll range configuration for state transitions
 */
export interface ScrollRange {
  start: number;
  end: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Scroll ranges for morphing transitions
 * Values represent scroll position in pixels
 */
export const SCROLL_RANGES = {
  /** Range where menu morphs from inline to compact */
  inlineToCompact: {
    start: 0,
    end: 100,
  },
  /** Scroll position where menu is fully compact */
  compactThreshold: 100,
} as const;

/**
 * Timing configurations for different morph phases
 */
export const MORPH_TIMINGS = {
  /** Duration for layout morph (position, size) */
  layout: durations.s.moderate,
  /** Duration for content crossfade */
  content: durations.s.fast,
  /** Duration for overlay appearance */
  overlay: durations.s.normal,
  /** Delay before content starts animating */
  contentDelay: 0.05,
  /** Stagger delay between menu items */
  itemStagger: 0.04,
} as const;

/**
 * Border radius values for different states
 */
export const BORDER_RADIUS = {
  inline: 24,
  compact: 20,
  overlay: 24,
} as const;

/**
 * Size constraints for morphing container
 */
export const SIZE_CONSTRAINTS = {
  inline: {
    width: 'auto',
    height: 56,
    minWidth: 'auto',
  },
  compact: {
    width: 80,
    height: 64,
    minWidth: 80,
  },
  overlay: {
    width: 'auto',
    height: 'auto',
    minWidth: 320,
  },
} as const;

/**
 * Padding values for different states
 */
export const PADDING = {
  inline: {
    x: 24,
    y: 12,
  },
  compact: {
    x: 16,
    y: 16,
  },
  overlay: {
    x: 24,
    y: 20,
  },
} as const;

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================

/**
 * Specialized spring configurations for menu morphing
 * Tuned for natural, smooth transitions without overshooting
 */
export const morphSprings = {
  /** Layout spring for position and size changes - smooth, no overshoot */
  layout: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
  /** Content spring for opacity and scale - snappy response */
  content: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 35,
    mass: 0.6,
  },
  /** Overlay spring for menu expansion - gentle, elegant */
  overlay: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 26,
    mass: 0.8,
  },
} as const;

// ============================================================================
// VARIANT DEFINITIONS
// ============================================================================

/**
 * Menu container morph variants
 * Controls the container's position, size, and border radius transitions
 * Uses layout prop for GPU-accelerated morphing
 */
export const menuMorphVariants: Variants = {
  inline: {
    position: 'relative' as const,
    borderRadius: BORDER_RADIUS.inline,
    paddingLeft: PADDING.inline.x,
    paddingRight: PADDING.inline.x,
    paddingTop: PADDING.inline.y,
    paddingBottom: PADDING.inline.y,
    width: SIZE_CONSTRAINTS.inline.width,
    height: SIZE_CONSTRAINTS.inline.height,
    transition: morphSprings.layout,
  },
  compact: {
    position: 'fixed' as const,
    top: 20,
    left: 20,
    borderRadius: BORDER_RADIUS.compact,
    paddingLeft: PADDING.compact.x,
    paddingRight: PADDING.compact.x,
    paddingTop: PADDING.compact.y,
    paddingBottom: PADDING.compact.y,
    width: SIZE_CONSTRAINTS.compact.width,
    height: SIZE_CONSTRAINTS.compact.height,
    transition: morphSprings.layout,
  },
  overlay: {
    position: 'fixed' as const,
    top: 20,
    left: 20,
    borderRadius: BORDER_RADIUS.overlay,
    paddingLeft: PADDING.overlay.x,
    paddingRight: PADDING.overlay.x,
    paddingTop: PADDING.overlay.y,
    paddingBottom: PADDING.overlay.y,
    width: SIZE_CONSTRAINTS.overlay.width,
    minWidth: SIZE_CONSTRAINTS.overlay.minWidth,
    transition: morphSprings.overlay,
  },
};

/**
 * Menu content variants (menu items, navigation links)
 * Handles visibility and transitions for full menu content
 */
export const menuContentVariants: Variants = {
  inline: {
    opacity: opacities.visible,
    scale: 1,
    pointerEvents: 'auto' as const,
    transition: {
      ...morphSprings.content,
      delay: MORPH_TIMINGS.contentDelay,
    },
  },
  compact: {
    opacity: opacities.hidden,
    scale: 0.95,
    pointerEvents: 'none' as const,
    transition: morphSprings.content,
  },
  overlay: {
    opacity: opacities.visible,
    scale: 1,
    pointerEvents: 'auto' as const,
    transition: {
      ...morphSprings.overlay,
      delay: MORPH_TIMINGS.contentDelay,
    },
  },
};

/**
 * Button content variants (hamburger icon, compact button text)
 * Handles visibility for compact button state
 */
export const buttonContentVariants: Variants = {
  inline: {
    opacity: opacities.hidden,
    scale: 0.8,
    pointerEvents: 'none' as const,
    transition: morphSprings.content,
  },
  compact: {
    opacity: opacities.visible,
    scale: 1,
    pointerEvents: 'auto' as const,
    transition: {
      ...morphSprings.content,
      delay: MORPH_TIMINGS.contentDelay,
    },
  },
  overlay: {
    opacity: opacities.visible,
    scale: 1,
    pointerEvents: 'auto' as const,
    transition: morphSprings.overlay,
  },
};

/**
 * Overlay backdrop variants
 * Smooth backdrop fade for overlay state
 */
export const overlayBackdropVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    pointerEvents: 'none' as const,
    transition: {
      duration: MORPH_TIMINGS.overlay,
      ease: easings.easeIn as any,
    },
  },
  visible: {
    opacity: 0.6,
    pointerEvents: 'auto' as const,
    transition: {
      duration: MORPH_TIMINGS.overlay,
      ease: easings.easeOut as any,
    },
  },
};

/**
 * Overlay container variants
 * Used for the expanded menu overlay appearance
 */
export const overlayContainerVariants: Variants = {
  hidden: {
    opacity: opacities.hidden,
    scale: 0.95,
    y: -10,
    transition: {
      duration: durations.s.fast,
      ease: easings.easeIn as any,
    },
  },
  visible: {
    opacity: opacities.visible,
    scale: 1,
    y: 0,
    transition: morphSprings.overlay,
  },
};

/**
 * Menu item stagger variants
 * For animating individual menu items with stagger effect
 */
export const menuItemStaggerVariants = {
  container: {
    hidden: {
      opacity: opacities.hidden,
    },
    visible: {
      opacity: opacities.visible,
      transition: {
        when: 'beforeChildren',
        staggerChildren: MORPH_TIMINGS.itemStagger,
        delayChildren: MORPH_TIMINGS.contentDelay,
      },
    },
  },
  item: {
    hidden: {
      opacity: opacities.hidden,
      x: -10,
      scale: 0.95,
    },
    visible: {
      opacity: opacities.visible,
      x: 0,
      scale: 1,
      transition: morphSprings.content,
    },
  },
} as const;

// ============================================================================
// SCROLL INTERPOLATION MAPS
// ============================================================================

/**
 * Border radius interpolation map for useTransform
 * Maps scroll position to border radius value
 */
export const borderRadiusMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: [BORDER_RADIUS.inline, BORDER_RADIUS.compact],
};

/**
 * Width interpolation map for useTransform
 * Maps scroll position to width value
 */
export const widthMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: ['auto', SIZE_CONSTRAINTS.compact.width],
};

/**
 * Height interpolation map for useTransform
 * Maps scroll position to height value
 */
export const heightMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: [SIZE_CONSTRAINTS.inline.height, SIZE_CONSTRAINTS.compact.height],
};

/**
 * Padding X interpolation map for useTransform
 */
export const paddingXMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: [PADDING.inline.x, PADDING.compact.x],
};

/**
 * Padding Y interpolation map for useTransform
 */
export const paddingYMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: [PADDING.inline.y, PADDING.compact.y],
};

/**
 * Opacity interpolation map for menu content
 */
export const menuContentOpacityMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: [opacities.visible, opacities.hidden],
};

/**
 * Opacity interpolation map for button content
 */
export const buttonContentOpacityMap = {
  input: [0, SCROLL_RANGES.inlineToCompact.end],
  output: [opacities.hidden, opacities.visible],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine current morph state based on scroll position and overlay state
 *
 * @param scrollY - Current scroll position in pixels
 * @param isOverlay - Whether overlay menu is currently open
 * @returns Current morph state
 *
 * @example
 * ```tsx
 * const state = getMorphState(150, false); // Returns 'compact'
 * ```
 */
export function getMorphState(scrollY: number, isOverlay: boolean): MorphState {
  if (isOverlay) {
    return 'overlay';
  }

  if (scrollY >= SCROLL_RANGES.compactThreshold) {
    return 'compact';
  }

  return 'inline';
}

/**
 * Generate consistent layoutId for Framer Motion shared layout animations
 *
 * @param menuId - Unique identifier for the menu instance
 * @returns Layout ID string
 *
 * @example
 * ```tsx
 * <motion.div layoutId={getLayoutId('main-menu')}>
 * ```
 */
export function getLayoutId(menuId: string): string {
  return `menu-morph-${menuId}`;
}

/**
 * Get appropriate spring configuration for a state transition
 *
 * @param fromState - Starting state
 * @param toState - Target state
 * @returns Spring configuration object
 *
 * @example
 * ```tsx
 * const spring = getMorphTransition('inline', 'compact');
 * ```
 */
export function getMorphTransition(
  fromState: MorphState,
  toState: MorphState
): SpringConfig {
  // Overlay transitions use overlay spring
  if (fromState === 'overlay' || toState === 'overlay') {
    return morphSprings.overlay;
  }

  // Inline <-> Compact uses layout spring
  if (
    (fromState === 'inline' && toState === 'compact') ||
    (fromState === 'compact' && toState === 'inline')
  ) {
    return morphSprings.layout;
  }

  // Default to layout spring
  return morphSprings.layout;
}

/**
 * Calculate scroll progress between inline and compact states
 *
 * @param scrollY - Current scroll position
 * @returns Progress value between 0 (inline) and 1 (compact)
 *
 * @example
 * ```tsx
 * const progress = getScrollProgress(50); // Returns 0.5
 * ```
 */
export function getScrollProgress(scrollY: number): number {
  const { start, end } = SCROLL_RANGES.inlineToCompact;
  return Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
}

/**
 * Check if reduced motion is preferred
 * Can be extended to check system preferences
 *
 * @returns Boolean indicating if reduced motion should be used
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get motion-safe variants with reduced animation for accessibility
 *
 * @param variants - Original variants object
 * @returns Variants with reduced motion applied if necessary
 */
export function getMotionSafeVariants(variants: Variants): Variants {
  if (!shouldReduceMotion()) {
    return variants;
  }

  // For reduced motion, only animate opacity and remove transforms
  const reducedVariants: Variants = {};

  Object.keys(variants).forEach((key) => {
    const variant = variants[key];
    if (typeof variant === 'object') {
      reducedVariants[key] = {
        opacity: variant.opacity ?? opacities.visible,
        transition: {
          duration: durations.s.instant,
        },
      };
    }
  });

  return reducedVariants;
}

// ============================================================================
// CONSOLIDATED EXPORT
// ============================================================================

/**
 * Centralized export of all menu morph animation resources
 */
export const menuMorph = {
  // Constants
  scrollRanges: SCROLL_RANGES,
  timings: MORPH_TIMINGS,
  borderRadius: BORDER_RADIUS,
  sizeConstraints: SIZE_CONSTRAINTS,
  padding: PADDING,

  // Springs
  springs: morphSprings,

  // Variants
  variants: {
    container: menuMorphVariants,
    menuContent: menuContentVariants,
    buttonContent: buttonContentVariants,
    overlayBackdrop: overlayBackdropVariants,
    overlayContainer: overlayContainerVariants,
    menuItemStagger: menuItemStaggerVariants,
  },

  // Interpolation maps
  interpolation: {
    borderRadius: borderRadiusMap,
    width: widthMap,
    height: heightMap,
    paddingX: paddingXMap,
    paddingY: paddingYMap,
    menuContentOpacity: menuContentOpacityMap,
    buttonContentOpacity: buttonContentOpacityMap,
  },

  // Utility functions
  utils: {
    getMorphState,
    getLayoutId,
    getMorphTransition,
    getScrollProgress,
    shouldReduceMotion,
    getMotionSafeVariants,
  },
} as const;

export default menuMorph;
