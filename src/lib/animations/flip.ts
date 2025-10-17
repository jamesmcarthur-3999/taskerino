/**
 * FLIP animation helpers
 *
 * FLIP = First, Last, Invert, Play
 * Provides smooth layout transitions by calculating and animating between states.
 */

import type { FLIPState, AnimationTransition } from './types';
import { springPresets } from './presets';

/**
 * Calculate FLIP state for an element
 * FLIP = First, Last, Invert, Play
 *
 * @param element - The DOM element to calculate FLIP for
 * @param firstRect - The initial position (First)
 * @returns FLIP state with invert calculations
 */
export function calculateFLIP(
  element: HTMLElement,
  firstRect: DOMRect
): FLIPState {
  const lastRect = element.getBoundingClientRect();

  return {
    first: firstRect,
    last: lastRect,
    invert: {
      x: firstRect.left - lastRect.left,
      y: firstRect.top - lastRect.top,
      scaleX: firstRect.width / lastRect.width,
      scaleY: firstRect.height / lastRect.height,
    },
  };
}

/**
 * Apply FLIP animation to an element
 *
 * @param element - The element to animate
 * @param flipState - The FLIP state
 * @param transition - Optional transition config
 */
export function applyFLIPAnimation(
  element: HTMLElement,
  flipState: FLIPState,
  transition: AnimationTransition = springPresets.smooth
): Animation {
  const { invert } = flipState;

  // Invert: Apply the inverted transform
  element.style.transform = `translate(${invert.x}px, ${invert.y}px) scale(${invert.scaleX}, ${invert.scaleY})`;
  element.style.transformOrigin = 'top left';

  // Force a reflow
  element.offsetHeight;

  // Play: Animate to the final state
  return element.animate(
    [
      {
        transform: `translate(${invert.x}px, ${invert.y}px) scale(${invert.scaleX}, ${invert.scaleY})`,
      },
      {
        transform: 'translate(0, 0) scale(1, 1)',
      },
    ],
    {
      duration: (transition.duration || 0.3) * 1000,
      easing: Array.isArray(transition.ease)
        ? `cubic-bezier(${transition.ease.join(',')})`
        : transition.ease || 'ease-out',
      fill: 'both',
    }
  );
}

/**
 * Higher-level FLIP helper for layout transitions
 *
 * @param element - The element to animate
 * @param callback - Function that triggers the layout change
 * @param transition - Optional transition config
 */
export async function performFLIPTransition(
  element: HTMLElement,
  callback: () => void | Promise<void>,
  transition?: AnimationTransition
): Promise<void> {
  // First: Capture initial position
  const firstRect = element.getBoundingClientRect();

  // Execute the change
  await callback();

  // Last: Capture final position
  const flipState = calculateFLIP(element, firstRect);

  // Invert and Play
  const animation = applyFLIPAnimation(element, flipState, transition);

  await animation.finished;
}
