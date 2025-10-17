/**
 * Easing Functions for Smooth Animations
 *
 * A comprehensive collection of easing functions to create natural,
 * polished animations throughout the application.
 */

// ============================================================================
// CUBIC EASING - Smooth and Natural
// ============================================================================

/**
 * Ease Out Cubic - Fast start, slow end (most common for exits/decelerations)
 * Perfect for: Fading out, scaling down, elements leaving
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease In Cubic - Slow start, fast end
 * Perfect for: Elements entering from rest
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Ease In-Out Cubic - Slow start and end, fast middle
 * Perfect for: General purpose smooth animations
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================================
// QUARTIC EASING - More Dramatic
// ============================================================================

/**
 * Ease Out Quart - Very smooth deceleration
 * Perfect for: Scroll-based animations, smooth stops
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Ease In-Out Quart - Smooth acceleration and deceleration
 * Perfect for: Position transitions, morphing
 */
export function easeInOutQuart(t: number): number {
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ============================================================================
// QUINTIC EASING - Very Smooth
// ============================================================================

/**
 * Ease Out Quint - Ultra smooth deceleration
 * Perfect for: Long-duration scroll animations
 */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

// ============================================================================
// EXPONENTIAL EASING - Sharp Changes
// ============================================================================

/**
 * Ease Out Expo - Very fast deceleration
 * Perfect for: Snap-to effects, quick reveals
 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Ease In-Out Expo - Sharp middle, smooth ends
 * Perfect for: Dynamic emphasis animations
 */
export function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ============================================================================
// ELASTIC EASING - Bouncy and Playful
// ============================================================================

/**
 * Ease Out Elastic - Bouncy overshoot at the end
 * Perfect for: UI elements that should feel playful, menu reveals
 *
 * @param amplitude - Controls bounce intensity (default: 1)
 * @param period - Controls bounce frequency (default: 0.3)
 */
export function easeOutElastic(t: number, amplitude: number = 1, period: number = 0.3): number {
  if (t === 0) return 0;
  if (t === 1) return 1;

  const s = period / 4;
  return amplitude * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1;
}

/**
 * Ease Out Elastic (Light) - Subtle bounce
 * Perfect for: Logo morphing, button presses
 */
export function easeOutElasticLight(t: number): number {
  return easeOutElastic(t, 0.8, 0.4);
}

/**
 * Ease In-Out Elastic - Bouncy on both ends
 * Perfect for: Attention-grabbing animations
 */
export function easeInOutElastic(t: number, amplitude: number = 1, period: number = 0.3): number {
  if (t === 0) return 0;
  if (t === 1) return 1;

  const s = period / 4;

  if (t < 0.5) {
    return -(amplitude * Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / period)) / 2;
  }

  return (amplitude * Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / period)) / 2 + 1;
}

// ============================================================================
// BACK EASING - Slight Overshoot
// ============================================================================

/**
 * Ease Out Back - Slight overshoot at the end
 * Perfect for: Scale animations, smooth morphing
 *
 * @param overshoot - Controls overshoot amount (default: 1.70158)
 */
export function easeOutBack(t: number, overshoot: number = 1.70158): number {
  const c1 = overshoot;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Ease In-Out Back - Overshoot on both ends
 * Perfect for: Dynamic UI transitions
 */
export function easeInOutBack(t: number, overshoot: number = 1.70158): number {
  const c1 = overshoot;
  const c2 = c1 * 1.525;

  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

// ============================================================================
// SPRING PHYSICS - Natural Motion
// ============================================================================

/**
 * Spring Easing - Physics-based spring motion
 * Perfect for: Natural-feeling UI animations
 *
 * @param t - Progress (0-1)
 * @param stiffness - Spring stiffness (default: 170)
 * @param damping - Spring damping (default: 26)
 * @param mass - Spring mass (default: 1)
 */
export function spring(
  t: number,
  stiffness: number = 170,
  damping: number = 26,
  mass: number = 1
): number {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) {
    // Underdamped (bouncy)
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * Math.cos(omegaD * t);
  } else if (zeta === 1) {
    // Critically damped (no bounce)
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  } else {
    // Overdamped (very slow)
    const r1 = -omega * (zeta - Math.sqrt(zeta * zeta - 1));
    const r2 = -omega * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }
}

/**
 * Smooth Spring - Gentle spring with subtle bounce
 * Perfect for: Menu expansions, smooth reveals
 */
export function smoothSpring(t: number): number {
  return spring(t, 200, 30, 1);
}

/**
 * Bouncy Spring - More pronounced bounce
 * Perfect for: Playful UI elements
 */
export function bouncySpring(t: number): number {
  return spring(t, 170, 20, 1);
}

// ============================================================================
// CUSTOM COMPOSITE EASING
// ============================================================================

/**
 * Logo Morph Easing - Custom curve for logo → menu button transition
 * Combines elastic and smooth easing for a polished feel
 */
export function logoMorphEasing(t: number): number {
  // Use elastic for the first 70%, then smooth out
  if (t < 0.7) {
    return easeOutElasticLight(t / 0.7) * 0.85;
  } else {
    const remaining = (t - 0.7) / 0.3;
    return 0.85 + (easeOutQuart(remaining) * 0.15);
  }
}

/**
 * Scroll Progress Easing - Better scroll-based animation feel
 * Provides smooth acceleration at start, steady middle, smooth deceleration at end
 */
export function scrollProgressEasing(t: number): number {
  // Use ease-out-quart for smooth scroll feel
  return easeOutQuart(t);
}

/**
 * Stagger Delay Calculator - For staggered animations
 *
 * @param index - Element index in sequence
 * @param baseDelay - Base delay in ms (default: 50)
 * @param maxDelay - Maximum delay cap in ms (default: 200)
 */
export function staggerDelay(index: number, baseDelay: number = 50, maxDelay: number = 200): number {
  return Math.min(index * baseDelay, maxDelay);
}

/**
 * Velocity-based Easing - Adjust easing based on scroll velocity
 *
 * @param velocity - Current scroll velocity (pixels/ms)
 * @param minVelocity - Minimum velocity threshold (default: 0.5)
 * @param maxVelocity - Maximum velocity threshold (default: 3)
 */
export function velocityBasedEasing(velocity: number, minVelocity: number = 0.5, maxVelocity: number = 3): (t: number) => number {
  const normalizedVelocity = Math.max(0, Math.min(1, (velocity - minVelocity) / (maxVelocity - minVelocity)));

  // Low velocity: use smooth easing
  // High velocity: use snappier easing
  return (t: number) => {
    const smoothValue = easeOutQuart(t);
    const snappyValue = easeOutCubic(t);
    return smoothValue * (1 - normalizedVelocity) + snappyValue * normalizedVelocity;
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Smooth step function (smoothstep)
 * Creates a smooth transition between 0 and 1
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smoother step function (even smoother than smoothstep)
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
