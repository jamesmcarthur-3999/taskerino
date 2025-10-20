/**
 * MorphingMenuButton Component - TRUE MORPHING EDITION
 *
 * A morphing menu system that TRULY morphs between states using a single element.
 * No unmounting/remounting - just pure shape, size, and position transformation.
 *
 * Features MAXIMUM POLISH:
 * - Single-element morphing with Framer Motion layout prop
 * - Scroll-driven transforms for smooth inline → compact transition
 * - Advanced border radius morphing with spring physics
 * - Scale bounce on interactions (click/hover)
 * - Shadow morphing based on state
 * - Progressive backdrop blur effect
 * - Perfect content crossfade with timing
 * - Smart pointer events during animations
 * - Will-change optimization for performance
 * - Reduced motion support
 */

import { type ReactNode, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { useUI } from '../context/UIContext';
import { useCompactNavigation } from '../hooks/useCompactNavigation';
import { NAVIGATION } from '../design-system/theme';

interface MorphingMenuButtonProps {
  menuContent: ReactNode;
  className?: string;
}

export function MorphingMenuButton({
  menuContent,
  className = ''
}: MorphingMenuButtonProps) {
  const { scrollY, scrollYMotionValue } = useScrollAnimation();
  const { state, dispatch } = useUI();
  const { showSubMenuOverlay } = state;
  const isCompact = useCompactNavigation();

  // Animation state management
  const [isHovered, setIsHovered] = useState(false);
  const [prevOverlayState, setPrevOverlayState] = useState(showSubMenuOverlay);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Determine display state for content - USE SAME THRESHOLD FOR CONSISTENCY
  const showMenuContent = scrollY < 100 || showSubMenuOverlay;
  const showCompactButton = scrollY >= 100 && !showSubMenuOverlay;

  // ESC key closes overlay
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSubMenuOverlay) {
        dispatch({ type: 'SET_SUBMENU_OVERLAY', payload: false });
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSubMenuOverlay, dispatch]);

  // ============================================================================
  // TRUE MORPHING: Scroll-Driven Position & Size Transforms
  // ============================================================================

  // Position: Morphs from relative (inline) to fixed (at logo position)
  const position = (scrollY >= 100 || showSubMenuOverlay) ? 'fixed' : 'relative';

  // Top position: 0 when inline, adaptive for scrolled state based on compact mode
  const top = showSubMenuOverlay ? 80 : (scrollY >= 100 ? (isCompact ? 12 : 16) : 0);

  // Left position: 0 when inline, adaptive for scrolled/overlay based on compact mode
  // On compact mode, position further right to avoid navigation island overlap
  const left = scrollY >= 100 || showSubMenuOverlay ? (isCompact ? 72 : 24) : 0;

  // Width: full-width → compact (logo + menu text) → overlay full-width
  // In compact-compact mode (narrow + scrolled), set fixed width for circular button
  const widthValue = showSubMenuOverlay ? 'auto' : (scrollY >= 100 ? (isCompact ? '40px' : 'auto') : 'auto');

  // ============================================================================
  // Border Radius Morphing with Spring Physics
  // ============================================================================
  // Use 9999px (rounded-full) for compact state to match logo exactly
  const borderRadiusTarget = showSubMenuOverlay ? 24 : (scrollY >= 100 ? 9999 : 24);
  const borderRadiusRaw = useTransform(
    scrollYMotionValue,
    [0, 100],
    [24, 9999]
  );
  const borderRadius = useSpring(showSubMenuOverlay ? 24 : borderRadiusRaw, {
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  });

  // ============================================================================
  // Scale Bounce on Interactions
  // ============================================================================
  const scaleMotionValue = useMotionValue(1);
  const scaleSpring = useSpring(scaleMotionValue, {
    stiffness: 400,
    damping: 25,
    mass: 0.5,
  });

  const handlePointerDown = () => {
    if (prefersReducedMotion || !showCompactButton) return;
    scaleMotionValue.set(1.05);
  };

  const handlePointerUp = () => {
    if (prefersReducedMotion || !showCompactButton) return;
    scaleMotionValue.set(isHovered ? 1.02 : 1.0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!prefersReducedMotion && showCompactButton) {
      scaleMotionValue.set(1.02);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!prefersReducedMotion && showCompactButton) {
      scaleMotionValue.set(1.0);
    }
  };

  const handleClick = () => {
    if (showCompactButton) {
      dispatch({ type: 'TOGGLE_SUBMENU_OVERLAY' });
    }
  };

  // ============================================================================
  // Subtle Rotation on Overlay Toggle
  // ============================================================================
  const rotation = useMotionValue(0);
  const rotationSpring = useSpring(rotation, {
    stiffness: 260,
    damping: 26,
    mass: 0.6,
  });

  useEffect(() => {
    if (prefersReducedMotion) return;

    // Rotate when overlay state changes
    if (prevOverlayState !== showSubMenuOverlay) {
      rotation.set(2.5);
      setTimeout(() => rotation.set(0), 300);
      setPrevOverlayState(showSubMenuOverlay);
    }
  }, [showSubMenuOverlay, prevOverlayState, rotation, prefersReducedMotion]);

  // ============================================================================
  // Shadow Morphing
  // ============================================================================
  const shadowClass = useMemo(() => {
    if (showSubMenuOverlay) return 'shadow-2xl';
    if (scrollY >= 100) return isHovered ? 'shadow-2xl' : 'shadow-xl';
    return 'shadow-lg';
  }, [scrollY, showSubMenuOverlay, isHovered]);

  // ============================================================================
  // Will-Change Optimization
  // ============================================================================
  const [willChangeActive, setWillChangeActive] = useState(false);
  useEffect(() => {
    if (scrollY > 20 && scrollY < 100) {
      setWillChangeActive(true);
      const timeout = setTimeout(() => setWillChangeActive(false), 150);
      return () => clearTimeout(timeout);
    }
  }, [scrollY]);
  const willChangeStyle = willChangeActive ? 'transform, opacity, border-radius' : 'auto';

  // Content animation variants
  const contentVariants = {
    hidden: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.95,
      transition: { duration: prefersReducedMotion ? 0 : 0.1 }
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.2,
        staggerChildren: prefersReducedMotion ? 0 : 0.03,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      }
    },
    exit: {
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.95,
      transition: { duration: prefersReducedMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -10,
      scale: prefersReducedMotion ? 1 : 0.95,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 35,
      },
    },
  };

  return (
    <>
      {/* Progressive Backdrop Blur */}
      <AnimatePresence>
        {showSubMenuOverlay && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{
              opacity: 1,
              backdropFilter: 'blur(8px)',
            }}
            exit={{
              opacity: 0,
              backdropFilter: 'blur(0px)',
            }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.3,
              ease: 'easeOut',
            }}
            className="fixed inset-0 bg-black/20 z-[90]"
            onClick={() => dispatch({ type: 'SET_SUBMENU_OVERLAY', payload: false })}
            aria-label="Close menu overlay"
          />
        )}
      </AnimatePresence>

      {/* Main Morphing Container - SINGLE ELEMENT */}
      <motion.div
        layout
        animate={{
          position,
          top,
          left,
          width: widthValue,
        }}
        transition={{
          type: 'spring',
          stiffness: prefersReducedMotion ? 500 : 400,
          damping: prefersReducedMotion ? 50 : 35,
          mass: 0.8,
          duration: prefersReducedMotion ? 0 : undefined,
        }}
        style={{
          borderRadius,
          scale: showCompactButton ? scaleSpring : 1,
          rotate: rotationSpring,
          willChange: willChangeStyle,
          zIndex: 100,
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`flex items-center gap-2.5 ${showCompactButton && isCompact ? 'p-0 h-10 w-10 justify-center' : 'px-5 py-4'} bg-white/40 backdrop-blur-xl border-2 border-white/50 ring-1 ring-black/5 ${shadowClass} origin-top-left overflow-hidden ${showCompactButton ? 'cursor-pointer' : ''} ${isHovered && showCompactButton ? 'bg-white/50' : ''} ${className}`}
        role={showCompactButton ? 'button' : undefined}
        aria-label={showCompactButton ? 'Open navigation menu' : undefined}
        aria-expanded={showSubMenuOverlay}
      >
        {/* Content Crossfade */}
        <AnimatePresence mode="wait">
          {showMenuContent && (
            <motion.div
              key="menu-content"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex items-center justify-between w-full"
            >
              {/* Show full menuContent in both inline mode AND overlay mode */}
              <motion.div variants={itemVariants} className="flex items-center gap-3 w-full">
                {menuContent}
              </motion.div>

              {/* Show close button only in overlay mode */}
              {showSubMenuOverlay && (
                <>
                  {/* Divider */}
                  <motion.div
                    variants={itemVariants}
                    className="h-8 w-px bg-white/30 ml-2"
                  />

                  {/* Close button */}
                  <motion.button
                    variants={itemVariants}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'SET_SUBMENU_OVERLAY', payload: false });
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/50 hover:bg-white/70 transition-all text-gray-700 hover:text-red-600 border-2 border-white/60 hover:shadow-md ml-0.5"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-sm font-medium">Close</span>
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {showCompactButton && (
            <motion.div
              key="compact-button"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`flex items-center ${isCompact ? 'justify-center' : 'gap-3'}`}
            >
              {/* Icon - hamburger menu icon in compact-compact mode, logo in normal compact mode */}
              <motion.div variants={itemVariants}>
                {isCompact ? (
                  <Menu className="w-5 h-5 text-gray-800" />
                ) : (
                  <div className={NAVIGATION.logo.iconBg}>
                    <span className="text-white font-bold text-xs">T</span>
                  </div>
                )}
              </motion.div>

              {/* Menu text - only show in normal compact mode, hide in compact-compact mode */}
              {!isCompact && (
                <motion.span
                  variants={itemVariants}
                  className="font-semibold text-base tracking-wide text-gray-800"
                >
                  Menu
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
