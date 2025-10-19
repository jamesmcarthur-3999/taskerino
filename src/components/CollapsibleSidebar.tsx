import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getGlassClasses, getRadiusClass, RADIUS } from '../design-system/theme';
import { springs, durations, opacities } from '../animations/tokens';

export interface CollapsibleSidebarProps {
  width?: string;
  peekWidth?: string;
  collapseBreakpoint?: number;
  side?: 'left' | 'right';
  children: React.ReactNode;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * CollapsibleSidebar Component with Glass-Like Sliding Animations
 *
 * A sidebar with three states:
 * 1. LOCKED OPEN (default on large screens): Takes layout space, same height as sibling panel
 * 2. COLLAPSED: Shows only a peek strip, sibling panel takes full width
 * 3. HOVER-EXPANDED: Slides elegantly over content as glass overlay (from peek strip hover)
 *
 * Animation Features:
 * - Smooth spring physics for natural sliding motion
 * - Frosted glass morphism with backdrop blur
 * - Transform-based GPU-accelerated sliding
 * - Coordinated content fading with stagger
 * - Subtle shadow/elevation when expanded
 * - Respects prefers-reduced-motion
 */
export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  width = '320px',
  peekWidth = '16px',
  collapseBreakpoint = 1280,
  side = 'left',
  children,
  isExpanded: externalIsExpanded,
  onExpandedChange,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Track if sidebar is locked open (takes layout space) vs collapsed
  const [isLockedOpen, setIsLockedOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= collapseBreakpoint;
    }
    return false;
  });

  // Track if sidebar is temporarily expanded due to hover (overlay mode)
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);

  // Track peek strip hover for micro-interactions
  const [isPeekHovered, setIsPeekHovered] = useState(false);

  // Track if mouse is over the entire hover zone (peek + panel)
  const [isMouseInHoverZone, setIsMouseInHoverZone] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsExpanded !== undefined ? externalIsExpanded : isLockedOpen;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  // Auto-collapse on small screens (only when using internal state)
  useEffect(() => {
    // Skip resize handling if externally controlled
    if (externalIsExpanded !== undefined) {
      return;
    }

    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= collapseBreakpoint;

      // Auto-collapse when screen becomes small
      if (!isLargeScreen && isOpen) {
        setIsLockedOpen(false);
        setIsHoverExpanded(false);
        onExpandedChange?.(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [collapseBreakpoint, isOpen, onExpandedChange, externalIsExpanded]);

  // Handle hover zone entry - includes both peek strip and expanded panel
  const handleHoverZoneEnter = () => {
    setIsMouseInHoverZone(true);
    setIsPeekHovered(true);

    // Clear any pending collapse
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    // Expand after short delay
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(true);
    }, 100);
  };

  // Handle hover zone exit - only collapse when mouse leaves entire zone
  const handleHoverZoneLeave = () => {
    setIsMouseInHoverZone(false);
    setIsPeekHovered(false);

    // Clear expansion timeout if still pending
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Collapse with small delay for better UX
    if (isHoverExpanded) {
      collapseTimeoutRef.current = setTimeout(() => {
        setIsHoverExpanded(false);
      }, 150);
    }
  };

  // Determine rendering mode
  const showPeekStrip = !isOpen && !isHoverExpanded;
  const showSidebarAsOverlay = isHoverExpanded;
  const layoutModeActive = isOpen && !isHoverExpanded;

  // Animation transition - use instant if reduced motion preferred
  const slideTransition = prefersReducedMotion
    ? { duration: 0 }
    : springs.smooth;

  const fadeTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: durations.s.fast };

  // Coordinated transitions for smooth layout mode collapse
  // Content fades out first, then container width collapses
  const contentFadeTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: durations.s.fast };

  const containerSlideTransition = prefersReducedMotion
    ? { duration: 0 }
    : { ...springs.smooth, delay: layoutModeActive ? 0 : 0.1 }; // Delay collapse until fade completes

  const peekTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: durations.s.fast };

  return (
    <>
      {/* BACKDROP OVERLAY - Only for hover-expanded state with glass blur */}
      <AnimatePresence>
        {showSidebarAsOverlay && (
          <motion.div
            className="absolute inset-0 bg-black/8 backdrop-blur-[2px] pointer-events-none"
            style={{ zIndex: 25 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          />
        )}
      </AnimatePresence>

      {/* HOVER ZONE CONTAINER - Wraps both peek strip and overlay panel for unified hover tracking */}
      <div
        className="absolute top-0 h-full pointer-events-none"
        style={{
          [side]: '-24px',
          width: showSidebarAsOverlay ? `calc(${width} + 24px)` : peekWidth,
          zIndex: showSidebarAsOverlay ? 30 : 20,
        }}
        onMouseEnter={handleHoverZoneEnter}
        onMouseLeave={handleHoverZoneLeave}
      >
        {/* PEEK STRIP - Only shown when fully collapsed */}
        <AnimatePresence>
          {showPeekStrip && (
            <motion.div
              className={`
                absolute top-0 h-full cursor-pointer overflow-hidden pointer-events-auto
                ${getGlassClasses('strong')}
                ${side === 'left' ? 'rounded-r-lg' : 'rounded-l-lg'}
              `}
              style={{
                [side]: 0,
                width: peekWidth,
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                boxShadow: isPeekHovered
                  ? '0 0 20px rgba(6, 182, 212, 0.5)'
                  : '0 0 0 rgba(6, 182, 212, 0)',
              }}
              exit={{ opacity: 0 }}
              transition={peekTransition}
            >
              {/* Vertical lines indicator with staggered hover animation */}
              <div className="h-full flex items-center justify-center">
                <div className="flex gap-0.5">
                  {[
                    { baseHeight: 8, hoverHeight: 10, opacity: 0.6, delay: 0 },
                    { baseHeight: 6, hoverHeight: 8, opacity: 0.5, delay: 0.025 },
                    { baseHeight: 4, hoverHeight: 6, opacity: 0.4, delay: 0.05 },
                  ].map((line, index) => (
                    <motion.div
                      key={index}
                      className="w-0.5 bg-white rounded-full"
                      animate={{
                        height: `${(isPeekHovered ? line.hoverHeight : line.baseHeight) * 4}px`,
                        opacity: line.opacity,
                      }}
                      transition={{
                        ...peekTransition,
                        delay: line.delay,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SIDEBAR AS OVERLAY (Hover-Expanded) - Glass sheet sliding over content */}
        <AnimatePresence>
          {showSidebarAsOverlay && (
            <motion.div
              className={`
                absolute top-0 h-full flex-shrink-0 overflow-hidden pointer-events-auto
                ${getGlassClasses('strong')}
                rounded-[24px]
              `}
              style={{
                left: side === 'left' ? '24px' : undefined,
                right: side === 'right' ? '24px' : undefined,
                width: width,
              }}
              initial={{
                x: side === 'left' ? '-100%' : '100%',
                opacity: 0.8,
              }}
              animate={{
                x: 0,
                opacity: 1,
              }}
              exit={{
                x: side === 'left' ? '-100%' : '100%',
                opacity: 0.8,
              }}
              transition={slideTransition}
              // Enhanced shadow for glass sheet depth
              whileHover={{
                boxShadow: side === 'left'
                  ? '12px 0 48px rgba(0, 0, 0, 0.16), 6px 0 24px rgba(0, 0, 0, 0.12)'
                  : '-12px 0 48px rgba(0, 0, 0, 0.16), -6px 0 24px rgba(0, 0, 0, 0.12)',
              }}
            >
              {/* Content wrapper with staggered fade animation and overflow scroll */}
              <motion.div
                className="h-full overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  ...fadeTransition,
                  delay: 0.1,
                }}
              >
                {children}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR AS LAYOUT (Locked Open) - Takes space in flex layout */}
      <motion.div
        className="relative flex-shrink-0 h-full self-stretch overflow-hidden"
        animate={{
          width: layoutModeActive ? width : '0px',
        }}
        transition={containerSlideTransition}
      >
        {/* Content wrapper with fade animation - always render for smooth exit */}
        <motion.div
          className="h-full overflow-y-auto"
          style={{
            width: width,
            height: '100%',
            pointerEvents: layoutModeActive ? 'auto' : 'none', // Disable interaction when collapsed
          }}
          animate={{
            opacity: layoutModeActive ? opacities.visible : opacities.hidden,
          }}
          transition={contentFadeTransition}
        >
          {children}
        </motion.div>
      </motion.div>
    </>
  );
};
