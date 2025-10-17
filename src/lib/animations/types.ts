/**
 * Animation type definitions
 *
 * Core types for FLIP animations, stagger configurations, and transitions.
 */

/**
 * FLIP animation state
 * FLIP = First, Last, Invert, Play
 */
export interface FLIPState {
  first: DOMRect;
  last: DOMRect;
  invert: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  };
}

/**
 * Stagger animation config
 */
export interface StaggerConfig {
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: 1 | -1;
  when?: 'beforeChildren' | 'afterChildren';
}

/**
 * Animation transition config
 */
export interface AnimationTransition {
  type?: 'spring' | 'tween' | 'inertia';
  duration?: number;
  delay?: number;
  ease?: string | number[];
  stiffness?: number;
  damping?: number;
  mass?: number;
}
