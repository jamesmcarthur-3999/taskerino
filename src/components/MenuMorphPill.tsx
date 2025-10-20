import { useState, useEffect, useRef, useMemo, Children, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { motion, useTransform, useSpring, useMotionValue, AnimatePresence, MotionValue, clamp } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { useNavigationCoordination } from '../contexts/NavigationCoordinationContext';
import { springs } from '../animations/tokens';
import { MENU_PILL } from '../design-system/theme';

// Easing function for smooth morphing animations
const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

// Use centralized design system tokens
const SCROLL_THRESHOLDS = MENU_PILL.scrollThresholds;

// Viewport-proportional width calculations
// Ensures smooth scaling across all screen sizes from mobile (320px) to 5K (5120px)
const getResponsiveWidths = () => ({
  initial: Math.min(window.innerWidth * 0.35, 500),  // Max 500px for readability
  compact: Math.max(window.innerWidth * 0.09, 140)   // Min 140px to fit "Menu" button
});

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
  maxScroll: number; // Maximum scroll boundary to clamp stagger
  overlayOpen?: boolean;
}

function StaggeredItem({
  children,
  index,
  scrollYMotionValue,
  startScroll,
  staggerOffset,
  animationRange,
  maxScroll,
  overlayOpen = false,
}: StaggeredItemProps) {
  // Calculate per-item scroll ranges with boundary clamping
  // Ensures stagger animations complete within the global animation range
  const itemStartScroll = startScroll + (index * staggerOffset);
  const itemEndScroll = Math.min(itemStartScroll + animationRange, maxScroll);

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
  const { menuButtonPhase, invalidateMeasurements } = useNavigationCoordination();
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Refs for width measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const compactButtonRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  // MotionValue for initial width
  const initialWidthMotionValue = useMotionValue<number | null>(null);
  const [hasMeasured, setHasMeasured] = useState(false);

  // Use FIXED thresholds (no more dynamic recalculation)
  const thresholds = SCROLL_THRESHOLDS;

  // Viewport-proportional widths state (recalculated on resize)
  const [responsiveWidths, setResponsiveWidths] = useState(getResponsiveWidths());

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

  // States (using viewport-relative thresholds)
  const isScrolled = scrollY >= thresholds.end;
  const isTransitioning = scrollY >= thresholds.start && scrollY < thresholds.end;
  const shouldBeFixed = scrollY >= thresholds.start; // Go fixed when morphing starts

  // Convert children to array for individual animations
  const childArray = useMemo(() => {
    return Children.toArray(children).filter(child => isValidElement(child));
  }, [children]);

  // Measure width for morphing animation AND capture natural position
  // This runs when scrollY < thresholds.start to establish baseline measurements
  useEffect(() => {
    if (spacerRef.current && menuContentRef.current && scrollY < thresholds.start) {
      const width = menuContentRef.current.offsetWidth;

      if (width > 0) {
        initialWidthMotionValue.set(width);
        if (!hasMeasured) {
          setHasMeasured(true);
        }
      }

      // PHASE 1 FIX: Measure SPACER position throughout pre-transition range
      // Changed from scrollY < 5 to scrollY < thresholds.start to allow position capture during natural state
      if (scrollY < thresholds.start && !naturalPositionRef.current) {
        const rect = spacerRef.current.getBoundingClientRect();

        // Convert viewport-relative coordinates to document-relative
        naturalPositionRef.current = {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        };
      }
    }
  }, [scrollY, hasMeasured, initialWidthMotionValue, childArray, thresholds.start]);

  // Calculate final position (next to logo) independently of scroll state
  // This ensures the scrolled button position is always correct, even after note changes
  useEffect(() => {
    // PHASE 1 FIX: Force remeasurement when resetKey changes
    const shouldRemeasure = !finalPositionRef.current || resetKey !== undefined;

    if (shouldRemeasure) {
      // Small delay to ensure logo is in the DOM after note changes
      requestAnimationFrame(() => {
        // Use data-logo-container attribute for reliable logo detection
        const logoContainer =
          document.querySelector('[data-logo-container]') as HTMLElement ||
          document.querySelector('[class*="from-cyan-500"]') as HTMLElement;

        if (logoContainer) {
          const logoRect = logoContainer.getBoundingClientRect();
          const gap = 12;

          // CORRECT POSITIONING: Menu button goes BETWEEN logo and island
          // Position immediately after logo with gap
          finalPositionRef.current = {
            top: 16, // Match logo's top padding (pt-4)
            left: logoRect.right + window.scrollX + gap
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


  // Handle resize with requestAnimationFrame-based debouncing
  // Ensures smooth recalculation of viewport-relative values without layout thrashing
  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        // Update viewport-proportional widths
        setResponsiveWidths(getResponsiveWidths());

        // Force remeasurement of element positions
        naturalPositionRef.current = null;
        finalPositionRef.current = null;
        setHasMeasured(false);

        // Invalidate coordination context measurements
        invalidateMeasurements();

        rafId = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [invalidateMeasurements]);

  // Reset natural position when resetKey changes (e.g., note change, sidebar toggle)
  useEffect(() => {
    // Clear measurements - that's it, no position mode changes
    naturalPositionRef.current = null;
    finalPositionRef.current = null;
    setHasMeasured(false);
  }, [resetKey]);

  // GPU-ACCELERATED WIDTH: Use scaleX transform instead of width changes
  // Width changes trigger layout recalculation (expensive, causes jank)
  // scaleX uses GPU compositing layer (smooth 60fps performance)
  const initialWidth = initialWidthMotionValue.get() || responsiveWidths.initial;
  const targetWidth = responsiveWidths.compact;

  // Calculate scaleX factor: target width / initial width
  const scaleXMotionValue = useTransform(
    scrollYMotionValue,
    [thresholds.start, thresholds.end],
    [1, targetWidth / initialWidth] // Scale from 1 (100%) to compressed ratio
  );

  const scaleXSpring = useSpring(scaleXMotionValue, {
    ...springs.snappy,
    restSpeed: 0.001,  // Tighter rest detection for crisp finish
    restDelta: 0.001,
  });

  // Container width is now fixed (no CSS width animation, only transform)
  const containerWidth = overlayOpen ? 'auto' : (scrollY < thresholds.start ? 'auto' : initialWidth);

  // Dynamic transform-origin that points to final destination
  const transformOriginX = useTransform(
    scrollYMotionValue,
    () => {
      const initialWidth = initialWidthMotionValue.get();
      if (initialWidth === null || initialWidth === 0) {
        return '0%';
      }

      // Calculate offset from element's natural position
      const naturalLeft = naturalPositionRef.current?.left ?? 24;
      const targetLeftPosition = finalPositionRef.current?.left ?? naturalLeft;
      const offsetFromStart = targetLeftPosition - naturalLeft;

      // Transform origin as percentage within element width
      const originPercent = (offsetFromStart / initialWidth) * 100;

      // Clamp to valid range
      return `${Math.max(0, Math.min(100, originPercent))}%`;
    }
  );

  const transformOrigin = useTransform(
    [transformOriginX],
    ([x]) => `${x} 0%`  // top of element
  );

  // Position springs - smooth interpolation throughout the entire scroll range
  // OPTION C: Position handled by flex container, these springs are disabled
  const topMotionValue = useTransform(
    scrollYMotionValue,
    () => 0 // Always return 0 (no positioning)
  );
  const topSpring = useSpring(topMotionValue, {
    ...springs.snappy,
    restSpeed: 0.001,
    restDelta: 0.001,
  });

  const leftMotionValue = useTransform(
    scrollYMotionValue,
    () => 0 // Always return 0 (no positioning)
  );
  const leftSpring = useSpring(leftMotionValue, {
    ...springs.snappy,
    restSpeed: 0.001,
    restDelta: 0.001,
  });

  // Border radius (using viewport-relative thresholds and design system tokens)
  const borderRadiusRaw = useTransform(
    scrollYMotionValue,
    [thresholds.start, thresholds.end],
    [MENU_PILL.borderRadius.expanded, MENU_PILL.borderRadius.compact]
  );
  const borderRadius = useSpring(borderRadiusRaw, {
    ...springs.snappy,
    restSpeed: 0.001,
    restDelta: 0.001,
  });

  // PHASE 1 FIX: Extend compact button animation range to reduce pop-in effect
  // Changed from last 20% to last 50% of transition for smoother fade-in
  // This gives the button more time to fade in gracefully
  const compactOpacity = useTransform(
    scrollYMotionValue,
    [thresholds.end - (thresholds.end - thresholds.start) * 0.5, thresholds.end],
    [0, 1]
  );

  const compactScale = useTransform(
    scrollYMotionValue,
    [thresholds.end - (thresholds.end - thresholds.start) * 0.5, thresholds.end],
    [0.85, 1]
  );

  const compactY = useTransform(
    scrollYMotionValue,
    [thresholds.end - (thresholds.end - thresholds.start) * 0.5, thresholds.end],
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
  const scaleValue = useSpring(1, springs.stiff);

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

  // Will-change optimization (active during transition + buffer)
  const willChangeActive = scrollY > thresholds.start && scrollY < thresholds.end + 40;

  // Shadow
  const shadowClass = useMemo(() => {
    if (overlayOpen) return 'shadow-2xl';
    if (isScrolled) return 'shadow-xl';
    return 'shadow-lg';
  }, [isScrolled, overlayOpen]);

  // OPTION C: No position switching - container handles positioning
  // Keep these variables for now (will remove in Phase 4 cleanup)
  const position = undefined; // Not used
  const topValue = 0; // Not used
  const leftValue = 0; // Not used

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
          // OPTION C: No position, top, left - handled by parent container
          borderRadius,
          // Apply both scaleX (width morphing) and uniform scale (hover effect)
          scaleX: scrollY >= thresholds.start ? scaleXSpring : 1,
          scale: isScrolled ? scaleValue : 1,
          width: containerWidth,
          transformOrigin: scrollY >= thresholds.start ? 'left center' : transformOrigin,
          willChange: willChangeActive ? 'transform, opacity' : 'auto',
          zIndex: 100, // Higher than Navigation Island (z-50) to prevent overlap
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
          <AnimatePresence mode="wait">
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
                    startScroll={thresholds.start}
                    staggerOffset={10}
                    animationRange={thresholds.end - thresholds.start}
                    maxScroll={thresholds.end}
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
