/**
 * Animation System - Components
 *
 * Animated primitive components for common UI patterns.
 * Pre-configured with motion-safe defaults and accessibility features.
 */

import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HTMLMotionProps, Variants } from 'framer-motion';
import {
  fadeVariants,
  slideUpVariants,
  scaleUpVariants,
  staggerContainerVariants,
  listItemVariants,
  buttonInteractionVariants,
  cardInteractionVariants,
} from './variants';
import { useReducedMotion } from './hooks';
import { getMotionSafeVariant } from './utils';

// ============================================================================
// BASE ANIMATED COMPONENTS
// ============================================================================

/**
 * Animated div with motion-safe defaults
 */
export const AnimatedDiv = motion.div;

/**
 * Animated button with motion-safe defaults
 */
export const AnimatedButton = motion.button;

/**
 * Animated card/section with motion-safe defaults
 */
export const AnimatedCard = motion.div;

/**
 * Animated list with motion-safe defaults
 */
export const AnimatedList = motion.ul;

/**
 * Animated list item with motion-safe defaults
 */
export const AnimatedListItem = motion.li;

/**
 * Animated span with motion-safe defaults
 */
export const AnimatedSpan = motion.span;

// ============================================================================
// FADE COMPONENTS
// ============================================================================

export interface FadeInProps extends HTMLMotionProps<'div'> {
  /** Custom variants (will be motion-safe) */
  variants?: Variants;
  /** Delay before animation starts (seconds) */
  delay?: number;
  /** Animation duration (seconds) */
  duration?: number;
}

/**
 * Fade in component with motion-safe defaults
 */
export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, variants, delay = 0, duration, ...props }, ref) => {
    const reducedMotion = useReducedMotion();
    const safeVariants = getMotionSafeVariant(variants || fadeVariants, reducedMotion);

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={safeVariants}
        transition={{ delay, duration }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

FadeIn.displayName = 'FadeIn';

// ============================================================================
// SLIDE COMPONENTS
// ============================================================================

export interface SlideInProps extends HTMLMotionProps<'div'> {
  /** Custom variants (will be motion-safe) */
  variants?: Variants;
  /** Delay before animation starts (seconds) */
  delay?: number;
}

/**
 * Slide in from bottom with fade
 */
export const SlideIn = forwardRef<HTMLDivElement, SlideInProps>(
  ({ children, variants, delay = 0, ...props }, ref) => {
    const reducedMotion = useReducedMotion();
    const safeVariants = getMotionSafeVariant(variants || slideUpVariants, reducedMotion);

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={safeVariants}
        transition={{ delay }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

SlideIn.displayName = 'SlideIn';

// ============================================================================
// SCALE COMPONENTS
// ============================================================================

export interface ScaleInProps extends HTMLMotionProps<'div'> {
  /** Custom variants (will be motion-safe) */
  variants?: Variants;
  /** Delay before animation starts (seconds) */
  delay?: number;
}

/**
 * Scale in from center with fade
 */
export const ScaleIn = forwardRef<HTMLDivElement, ScaleInProps>(
  ({ children, variants, delay = 0, ...props }, ref) => {
    const reducedMotion = useReducedMotion();
    const safeVariants = getMotionSafeVariant(variants || scaleUpVariants, reducedMotion);

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={safeVariants}
        transition={{ delay }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

ScaleIn.displayName = 'ScaleIn';

// ============================================================================
// STAGGER COMPONENTS
// ============================================================================

export interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  /** Custom container variants */
  variants?: Variants;
  /** Delay before children start animating */
  delayChildren?: number;
  /** Delay between each child */
  staggerChildren?: number;
}

/**
 * Container for staggered children animations
 */
export const StaggerContainer = forwardRef<HTMLDivElement, StaggerContainerProps>(
  (
    {
      children,
      variants,
      delayChildren = 0,
      staggerChildren = 0.05,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion();
    const containerVars = variants || staggerContainerVariants;

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={containerVars}
        transition={{
          delayChildren: reducedMotion ? 0 : delayChildren,
          staggerChildren: reducedMotion ? 0 : staggerChildren,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

StaggerContainer.displayName = 'StaggerContainer';

export interface StaggerItemProps extends HTMLMotionProps<'div'> {
  /** Custom item variants */
  variants?: Variants;
}

/**
 * Item to be used within StaggerContainer
 */
export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ children, variants, ...props }, ref) => {
    const itemVars = variants || listItemVariants;

    return (
      <motion.div ref={ref} variants={itemVars} {...props}>
        {children}
      </motion.div>
    );
  }
);

StaggerItem.displayName = 'StaggerItem';

// ============================================================================
// INTERACTIVE BUTTON
// ============================================================================

export interface InteractiveButtonProps extends HTMLMotionProps<'button'> {
  /** Whether to disable interaction animations */
  disableAnimations?: boolean;
}

/**
 * Button with hover and tap animations
 */
export const InteractiveButton = forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  ({ children, disableAnimations = false, ...props }, ref) => {
    const reducedMotion = useReducedMotion();
    const shouldAnimate = !disableAnimations && !reducedMotion;

    return (
      <motion.button
        ref={ref}
        whileHover={shouldAnimate ? buttonInteractionVariants.hover : undefined}
        whileTap={shouldAnimate ? buttonInteractionVariants.tap : undefined}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

InteractiveButton.displayName = 'InteractiveButton';

// ============================================================================
// INTERACTIVE CARD
// ============================================================================

export interface InteractiveCardProps extends HTMLMotionProps<'div'> {
  /** Whether to disable interaction animations */
  disableAnimations?: boolean;
  /** Whether card is currently selected/active */
  isActive?: boolean;
}

/**
 * Card with hover and tap animations
 */
export const InteractiveCard = forwardRef<HTMLDivElement, InteractiveCardProps>(
  ({ children, disableAnimations = false, isActive = false, ...props }, ref) => {
    const reducedMotion = useReducedMotion();
    const shouldAnimate = !disableAnimations && !reducedMotion;

    return (
      <motion.div
        ref={ref}
        whileHover={shouldAnimate && !isActive ? cardInteractionVariants.hover : undefined}
        whileTap={shouldAnimate && !isActive ? cardInteractionVariants.tap : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

InteractiveCard.displayName = 'InteractiveCard';

// ============================================================================
// PRESENCE WRAPPER
// ============================================================================

export interface PresenceProps {
  /** Children to animate */
  children: React.ReactNode;
  /** Whether to show children */
  show: boolean;
  /** Animation mode */
  mode?: 'wait' | 'sync' | 'popLayout';
  /** Custom variants */
  variants?: Variants;
}

/**
 * Wrapper for AnimatePresence with motion-safe defaults
 */
export function Presence({ children, show, mode = 'wait', variants }: PresenceProps) {
  const reducedMotion = useReducedMotion();
  const safeVariants = getMotionSafeVariant(variants || fadeVariants, reducedMotion);

  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={safeVariants}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// CONDITIONAL RENDER
// ============================================================================

export interface ConditionalRenderProps {
  /** Condition to render children */
  when: boolean;
  /** Children to render */
  children: React.ReactNode;
  /** Fallback content when condition is false */
  fallback?: React.ReactNode;
  /** Animation variants */
  variants?: Variants;
  /** Animation mode */
  mode?: 'wait' | 'sync' | 'popLayout';
}

/**
 * Conditionally render with animations
 */
export function ConditionalRender({
  when,
  children,
  fallback,
  variants,
  mode = 'wait',
}: ConditionalRenderProps) {
  const reducedMotion = useReducedMotion();
  const safeVariants = getMotionSafeVariant(variants || fadeVariants, reducedMotion);

  return (
    <AnimatePresence mode={mode}>
      {when ? (
        <motion.div
          key="content"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={safeVariants}
        >
          {children}
        </motion.div>
      ) : fallback ? (
        <motion.div
          key="fallback"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={safeVariants}
        >
          {fallback}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ============================================================================
// LIST RENDERER
// ============================================================================

export interface AnimatedListProps<T> {
  /** Items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Key extractor */
  keyExtractor: (item: T, index: number) => string | number;
  /** Container props */
  containerProps?: HTMLMotionProps<'div'>;
  /** Item props */
  itemProps?: HTMLMotionProps<'div'>;
  /** Stagger delay between items */
  staggerDelay?: number;
  /** Container variants */
  containerVariants?: Variants;
  /** Item variants */
  itemVariants?: Variants;
}

/**
 * Animated list renderer with stagger support
 */
export function AnimatedListRenderer<T>({
  items,
  renderItem,
  keyExtractor,
  containerProps,
  itemProps,
  staggerDelay = 0.05,
  containerVariants,
  itemVariants,
}: AnimatedListProps<T>) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants || staggerContainerVariants}
      transition={{
        delayChildren: 0,
        staggerChildren: reducedMotion ? 0 : staggerDelay,
      }}
      {...containerProps}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item, index)}
            variants={itemVariants || listItemVariants}
            layout
            {...itemProps}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MODAL WRAPPER
// ============================================================================

export interface ModalWrapperProps extends HTMLMotionProps<'div'> {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Whether to close on backdrop click */
  closeOnBackdropClick?: boolean;
  /** Backdrop props */
  backdropProps?: HTMLMotionProps<'div'>;
}

/**
 * Animated modal wrapper with backdrop
 */
export const ModalWrapper = forwardRef<HTMLDivElement, ModalWrapperProps>(
  (
    {
      children,
      isOpen,
      onClose,
      closeOnBackdropClick = true,
      backdropProps,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion();
    const safeVariants = getMotionSafeVariant(scaleUpVariants, reducedMotion);

    const handleBackdropClick = (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose?.();
      }
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
              }}
              {...backdropProps}
            />

            {/* Modal Content */}
            <motion.div
              ref={ref}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={safeVariants}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1001,
              }}
              {...props}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

ModalWrapper.displayName = 'ModalWrapper';

// ============================================================================
// EXPORT ALL COMPONENTS
// ============================================================================

export const components = {
  // Base components
  AnimatedDiv,
  AnimatedButton,
  AnimatedCard,
  AnimatedList,
  AnimatedListItem,
  AnimatedSpan,

  // Animation components
  FadeIn,
  SlideIn,
  ScaleIn,

  // Stagger components
  StaggerContainer,
  StaggerItem,

  // Interactive components
  InteractiveButton,
  InteractiveCard,

  // Utility components
  Presence,
  ConditionalRender,
  AnimatedListRenderer,
  ModalWrapper,
} as const;

export default components;
