import { useState, useEffect, useRef, useMemo, Children, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { motion, useTransform, useSpring, useMotionValue, AnimatePresence, MotionValue } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';

interface MenuMorphPillProps {
  children: ReactNode;
  className?: string;
  resetKey?: string | number; // Triggers position recapture when changed
}

/**
 * Individual menu item with staggered exit using MotionValues
 */
interface StaggeredItemProps {
  children: ReactElement;
  index: number;
  scrollYMotionValue: MotionValue<number>;
  startScroll: number;
  staggerOffset: number;
  animationRange: number;
  overlayOpen?: boolean;
}

function StaggeredItem({
  children,
  index,
  scrollYMotionValue,
  startScroll,
  staggerOffset,
  animationRange,
  overlayOpen = false,
}: StaggeredItemProps) {
  // Calculate per-item scroll ranges
  const itemStartScroll = startScroll + (index * staggerOffset);
  const itemEndScroll = itemStartScroll + animationRange;

  // Create MotionValues using useTransform - GPU accelerated
  // When overlay is open, freeze animations at full visibility
  const opacity = useTransform(
    scrollYMotionValue,
    [itemStartScroll, itemEndScroll],
    overlayOpen ? [1, 1] : [1, 0]
  );

  const scale = useTransform(
    scrollYMotionValue,
    [itemStartScroll, itemEndScroll],
    overlayOpen ? [1, 1] : [1, 0.85]
  );

  const y = useTransform(
    scrollYMotionValue,
    [itemStartScroll, itemEndScroll],
    overlayOpen ? [0, 0] : [0, -30]
  );

  return (
    <motion.div
      style={{
        opacity,
        scale,
        y,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * MenuMorphPill - Production-ready continuous scroll-driven morphing
 *
 * TRUE MORPHING with proper MotionValues:
 * - Container WIDTH measured and morphed with MotionValue (NOT 'auto')
 * - EACH menu item exits with MotionValue transforms (NOT plain functions)
 * - AnimatePresence mode="sync" for clean crossfade
 * - 60fps GPU-accelerated throughout
 */
export function MenuMorphPill({ children, className = '', resetKey }: MenuMorphPillProps) {
  const { scrollY, scrollYMotionValue } = useScrollAnimation();
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Refs for width measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const compactButtonRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  // MotionValue for initial width
  const initialWidthMotionValue = useMotionValue<number | null>(null);
  const [hasMeasured, setHasMeasured] = useState(false);

  // Store the ORIGINAL natural position/dimensions when in document flow (scrollY = 0)
  // This represents where the element naturally lives before any positioning changes
  // Used as the baseline for ALL position calculations throughout the scroll lifecycle
  const naturalPositionRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);

  // Store the calculated final position (next to logo) when scrolled
  const finalPositionRef = useRef<{ top: number; left: number } | null>(null);

  // Reduced motion check
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // States
  const isScrolled = scrollY >= 220;
  const isTransitioning = scrollY >= 150 && scrollY < 220;
  const shouldBeFixed = scrollY >= 150; // Go fixed when morphing starts

  // Convert children to array for individual animations
  const childArray = useMemo(() => {
    return Children.toArray(children).filter(child => isValidElement(child));
  }, [children]);

  // Measure width for morphing animation AND capture natural position
  // This runs when scrollY < 150 to establish baseline measurements
  useEffect(() => {
    if (spacerRef.current && menuContentRef.current && scrollY < 150) {
      const width = menuContentRef.current.offsetWidth;

      if (width > 0) {
        initialWidthMotionValue.set(width);
        if (!hasMeasured) {
          setHasMeasured(true);
        }
      }

      // Measure SPACER position (which is always in document flow)
      if (scrollY < 5 && !naturalPositionRef.current) {
        const rect = spacerRef.current.getBoundingClientRect();

        naturalPositionRef.current = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        };
      }
    }
  }, [scrollY, hasMeasured, initialWidthMotionValue, childArray]);

  // Calculate final position (next to logo) independently of scroll state
  // This ensures the scrolled button position is always correct, even after note changes
  useEffect(() => {
    if (!finalPositionRef.current) {
      // Small delay to ensure logo is in the DOM after note changes
      requestAnimationFrame(() => {
        // Find the logo in the TopNavigation component
        const logoContainer = document.querySelector('[class*="from-cyan-500"]') as HTMLElement;
        if (logoContainer) {
          const logoRect = logoContainer.getBoundingClientRect();
          // Position button 12px to the right of the logo
          const gap = 12;
          finalPositionRef.current = {
            top: 16, // Match logo's top padding (pt-4)
            left: logoRect.right + gap
          };
        } else {
          // Fallback if logo not found
          finalPositionRef.current = {
            top: 16,
            left: 184 // Original fallback value
          };
        }
      });
    }
  }, [resetKey]); // Re-run when resetKey changes to recalculate logo position


  // Handle resize - reset all measurements
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && menuContentRef.current && scrollY === 0) {
        const width = menuContentRef.current.offsetWidth;
        if (width > 0) {
          initialWidthMotionValue.set(width);
        }
      }
      // Reset natural position capture on resize so it gets remeasured
      naturalPositionRef.current = null;
      finalPositionRef.current = null;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scrollY, initialWidthMotionValue]);

  // Reset natural position when resetKey changes (e.g., note change, sidebar toggle)
  useEffect(() => {
    // Clear measurements - that's it, no position mode changes
    naturalPositionRef.current = null;
    finalPositionRef.current = null;
    setHasMeasured(false);
  }, [resetKey]);

  // SOLUTION 2: Width transform with spring for unified motion
  const widthMotionValue = useTransform(
    scrollYMotionValue,
    [150, 220],
    [initialWidthMotionValue.get() || 400, 140]
  );

  const widthSpring = useSpring(widthMotionValue, {
    stiffness: 500,
    damping: 50,
    mass: 0.5,
    restSpeed: 0.01,
    restDelta: 0.01,
  });

  // Convert spring to CSS string (always called, not conditional)
  const widthString = useTransform(widthSpring, (w) => `${Math.round(w)}px`);

  // Apply width based on state
  const containerWidth = overlayOpen ? 'auto' : (scrollY < 150 ? 'auto' : widthString);

  // Dynamic transform-origin that points to final destination
  const transformOriginX = useTransform(
    scrollYMotionValue,
    () => {
      const initialWidth = initialWidthMotionValue.get();
      if (initialWidth === null || initialWidth === 0) {
        return '0%';
      }
      // Calculate percentage where final left position sits within initial width
      const targetLeftPosition = finalPositionRef.current?.left ?? naturalPositionRef.current?.left ?? 24;
      const originPercent = (targetLeftPosition / initialWidth) * 100;
      return `${originPercent}%`;
    }
  );

  const transformOrigin = useTransform(
    [transformOriginX],
    ([x]) => `${x} 0%`  // top of element
  );

  // Position springs - smooth interpolation throughout the entire scroll range
  // Key insight: We need to interpolate from natural position → final position (next to logo)
  const topMotionValue = useTransform(
    scrollYMotionValue,
    (scroll) => {
      const finalTop = finalPositionRef.current?.top ?? 16;

      if (scroll < 150) {
        // Before transition: use natural position
        return naturalPositionRef.current?.top ?? 110; // Use initial padding as fallback
      }
      if (scroll >= 220) {
        // After transition: use final fixed position (next to logo)
        return finalTop;
      }
      // During transition (150-220): interpolate from natural → final
      const startTop = naturalPositionRef.current?.top ?? finalTop;
      const progress = (scroll - 150) / 70;
      return startTop + (finalTop - startTop) * progress;
    }
  );
  const topSpring = useSpring(topMotionValue, {
    stiffness: 500,
    damping: 50,
    mass: 0.5,
    restSpeed: 0.01,
    restDelta: 0.01,
  });

  const leftMotionValue = useTransform(
    scrollYMotionValue,
    (scroll) => {
      const finalLeft = finalPositionRef.current?.left ?? 184;

      if (scroll < 150) {
        // Before transition: use natural position
        return naturalPositionRef.current?.left ?? 24; // Use reasonable fallback
      }
      if (scroll >= 220) {
        // After transition: use final fixed position (next to logo)
        return finalLeft;
      }
      // During transition (150-220): interpolate from natural → final
      const startLeft = naturalPositionRef.current?.left ?? finalLeft;
      const progress = (scroll - 150) / 70;
      return startLeft + (finalLeft - startLeft) * progress;
    }
  );
  const leftSpring = useSpring(leftMotionValue, {
    stiffness: 500,
    damping: 50,
    mass: 0.5,
    restSpeed: 0.01,
    restDelta: 0.01,
  });

  // Border radius
  const borderRadiusRaw = useTransform(scrollYMotionValue, [150, 220], [9999, 9999]);
  const borderRadius = useSpring(borderRadiusRaw, {
    stiffness: 500,
    damping: 50,
    mass: 0.5,
    restSpeed: 0.01,
    restDelta: 0.01,
  });

  // Compact button opacity (for crossfade)
  const compactOpacity = useTransform(
    scrollYMotionValue,
    [200, 220],
    [0, 1]
  );

  const compactScale = useTransform(
    scrollYMotionValue,
    [200, 220],
    [0.85, 1]
  );

  const compactY = useTransform(
    scrollYMotionValue,
    [200, 220],
    [-20, 0]
  );

  // Overlay mode position override
  useEffect(() => {
    if (overlayOpen) {
      // When overlay opens, move to center-top position
      topSpring.set(80);
      borderRadius.set(9999);
    } else {
      topSpring.set(topMotionValue.get());
      borderRadius.set(borderRadiusRaw.get());
    }
  }, [overlayOpen, topSpring, borderRadius, topMotionValue, borderRadiusRaw]);

  // Hover scale
  const [isHovered, setIsHovered] = useState(false);
  const scaleValue = useSpring(1, {
    stiffness: 500,
    damping: 40,
    mass: 0.4,
  });

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (isScrolled && !prefersReducedMotion) {
      scaleValue.set(1.02);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isScrolled && !prefersReducedMotion) {
      scaleValue.set(1.0);
    }
  };

  const handleClick = () => {
    if (isScrolled) {
      setOverlayOpen(true);
    }
  };

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayOpen) {
        setOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [overlayOpen]);

  // Will-change optimization
  const willChangeActive = scrollY > 150 && scrollY < 240;

  // Shadow
  const shadowClass = useMemo(() => {
    if (overlayOpen) return 'shadow-2xl';
    if (isScrolled) return 'shadow-xl';
    return 'shadow-lg';
  }, [isScrolled, overlayOpen]);

  // ALWAYS fixed positioning - no switching
  const position = 'fixed';

  // Always use spring values
  const topValue = topSpring;
  const leftValue = leftSpring;

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(3px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
            className="fixed inset-0 bg-black/5 z-[90]"
            onClick={() => setOverlayOpen(false)}
            aria-label="Close menu overlay"
          />
        )}
      </AnimatePresence>

      {/* Permanent spacer - ALWAYS maintains document flow */}
      <div
        ref={spacerRef}
        className="flex items-center gap-2.5 px-3 py-2"
        style={{
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-3">
          {childArray}
        </div>
      </div>

      {/* Morphing container */}
      <motion.div
        ref={containerRef}
        layout
        transition={{
          layout: {
            type: "spring",
            stiffness: 500,
            damping: 50,
            mass: 0.5,
          }
        }}
        style={{
          position,
          top: topValue,
          left: leftValue,
          borderRadius,
          scale: isScrolled ? scaleValue : 1,
          width: containerWidth,
          transformOrigin,
          willChange: willChangeActive ? 'transform, opacity' : 'auto',
          zIndex: 95,
        }}
        onClick={(e) => {
          // Only handle click if it's directly on the container (not a child button/dropdown)
          if (isScrolled && e.target === e.currentTarget) {
            handleClick();
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`flex items-center gap-2.5 ${isScrolled ? 'px-5 py-4' : 'px-3 py-2'} ${overlayOpen ? 'bg-white/60' : 'bg-white/40'} backdrop-blur-xl border-2 border-white/50 ring-1 ring-black/5 ${shadowClass} ${isScrolled ? 'cursor-pointer' : ''} ${isHovered && isScrolled && !overlayOpen ? 'bg-white/50' : ''} ${className}`}
        role={isScrolled ? 'button' : undefined}
        aria-label={isScrolled ? 'Open navigation menu' : undefined}
        aria-expanded={overlayOpen}
      >
        {/* Hidden measurement content */}
        <div style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <div ref={menuContentRef} className="flex items-center gap-3">
            {childArray}
          </div>
          <div ref={compactButtonRef} className="flex items-center gap-3">
            <Menu className="w-5 h-5" />
            <span className="font-semibold text-base">Menu</span>
          </div>
        </div>

        {/* Visible content with AnimatePresence */}
        <div className="relative flex items-center w-full flex-nowrap">
          <AnimatePresence mode="sync">
            {/* Full menu content with staggered item exits */}
            {(!isScrolled || overlayOpen) && (
              <motion.div
                key="menu-content"
                initial={false}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="flex items-center gap-3 w-full flex-nowrap"
                style={{
                  position: isScrolled && !overlayOpen ? 'absolute' : 'relative',
                }}
              >
                {childArray.map((child, index) => (
                  <StaggeredItem
                    key={index}
                    index={index}
                    scrollYMotionValue={scrollYMotionValue}
                    startScroll={150}
                    staggerOffset={10}
                    animationRange={70}
                    overlayOpen={overlayOpen}
                  >
                    {child as ReactElement}
                  </StaggeredItem>
                ))}

                {/* Close button when overlay open */}
                {overlayOpen && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverlayOpen(false);
                    }}
                    className="ml-auto flex items-center gap-2 px-3 py-2 rounded-full bg-white/50 hover:bg-white/70 transition-all text-gray-700 hover:text-red-600 border-2 border-white/60 hover:shadow-md"
                    aria-label="Close menu"
                  >
                    <span className="text-sm font-medium">Close</span>
                  </motion.button>
                )}
              </motion.div>
            )}

            {/* Compact "Menu" button */}
            {isScrolled && !overlayOpen && (
              <motion.div
                key="compact-button"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2 }}
                style={{
                  opacity: compactOpacity,
                  scale: compactScale,
                  y: compactY,
                }}
                className="flex items-center gap-3"
              >
                <Menu className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-base text-gray-800 tracking-wide">
                  Menu
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
