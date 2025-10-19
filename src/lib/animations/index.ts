/**
 * Animation Library
 *
 * A reusable animation utilities library extracted from the Morphing Canvas.
 * Provides FLIP animations, variants, stagger effects, and accessibility features.
 *
 * @module @/lib/animations
 */

// Types
export type {
  FLIPState,
  StaggerConfig,
  AnimationTransition,
} from './types';

// Presets
export {
  springPresets,
  easingPresets,
  durationPresets,
} from './presets';

// Convenience alias for springs
export { springPresets as springs } from './presets';

// FLIP animations
export {
  calculateFLIP,
  applyFLIPAnimation,
  performFLIPTransition,
} from './flip';

// Variants
export {
  fadeInVariants,
  slideUpVariants,
  scaleUpVariants,
  slideInRightVariants,
  slideInLeftVariants,
  bounceInVariants,
  moduleAnimationVariants,
  type ModuleAnimationVariantName,
} from './variants';

// Island-specific variants
export {
  islandSpring,
  islandContentSpring,
  islandVariants,
  modeContentVariants,
  getModeContentVariants,
} from './island-variants';

// Stagger animations
export {
  createStaggerVariants,
  createListStaggerVariants,
  getStaggerDelay,
} from './stagger';

// Accessibility
export {
  useReducedMotion,
  shouldReduceMotion,
  getMotionSafeVariant,
} from './accessibility';

// Provider
export {
  AnimationProvider,
  useAnimation,
} from './provider';

// Utilities
export {
  getLayoutTransition,
  createLayoutMorphTransition,
  mergeTransitions,
  createCustomVariants,
  animateSequence,
  animateParallel,
} from './utilities';
