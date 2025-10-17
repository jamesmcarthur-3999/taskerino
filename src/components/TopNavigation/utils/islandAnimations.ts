/**
 * Island Animations
 *
 * BACKWARDS COMPATIBLE RE-EXPORT
 * This module now re-exports from the unified animation system (@/lib/animations)
 * while maintaining the existing API for backwards compatibility.
 *
 * @deprecated Import from '@/lib/animations' instead
 */

// Re-export island-specific animations from unified system
export { islandVariants, modeContentVariants, springs } from '@/lib/animations';

// Re-export with original names for backwards compatibility
export { islandSpring as springConfig } from '@/lib/animations';
export { islandContentSpring as contentSpring } from '@/lib/animations';
