import React, { useState, useEffect, useRef } from 'react';
import { SIDEBAR_ANIMATION, STAGGER_DELAY, EASING } from '../design-system/theme';

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
 * CollapsibleSidebar Component with Premium Animations
 *
 * A sidebar with three states:
 * 1. LOCKED OPEN (default on large screens): Takes layout space, same height as sibling panel
 * 2. COLLAPSED: Shows only a peek strip, sibling panel takes full width
 * 3. HOVER-EXPANDED: Slides over content as overlay (from peek strip hover)
 *
 * Animation Features:
 * - Transform-based GPU-accelerated sliding
 * - Coordinated content fading (faster than slide)
 * - Smooth peek strip micro-interactions
 * - Backdrop fade for overlay mode
 * - Proper easing curves for natural motion
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
  // Track if sidebar is locked open (takes layout space) vs collapsed
  const [isLockedOpen, setIsLockedOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= collapseBreakpoint;
    }
    return false;
  });

  // Track if sidebar is temporarily expanded due to hover (overlay mode)
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);

  // Track animation state for coordinated transitions
  const [isAnimating, setIsAnimating] = useState(false);
  const [contentVisible, setContentVisible] = useState(isLockedOpen);

  // Track peek strip hover for micro-interactions
  const [isPeekHovered, setIsPeekHovered] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsExpanded !== undefined ? externalIsExpanded : isLockedOpen;

  // Auto-collapse on small screens (only when using internal state)
  useEffect(() => {
    // Skip resize handling if externally controlled
    // The parent component should handle responsive behavior
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

  // Coordinate content visibility with sidebar animation
  useEffect(() => {
    const willBeVisible = isOpen || isHoverExpanded;

    if (willBeVisible) {
      // Show content immediately when expanding
      setContentVisible(true);
      setIsAnimating(true);
    } else {
      // Hide content with delay when collapsing (fade out first)
      setIsAnimating(true);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = setTimeout(() => {
        setContentVisible(false);
        setIsAnimating(false);
      }, SIDEBAR_ANIMATION.contentFade.duration);
    }

    // Cleanup animation state
    const animationCleanup = setTimeout(() => {
      setIsAnimating(false);
    }, SIDEBAR_ANIMATION.slide.duration);

    return () => {
      clearTimeout(animationCleanup);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isOpen, isHoverExpanded]);

  // Handle peek strip hover - expand as overlay with delay
  const handlePeekMouseEnter = () => {
    setIsPeekHovered(true);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(true);
    }, 100);
  };

  const handlePeekMouseLeave = () => {
    setIsPeekHovered(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Handle sidebar mouse leave - collapse if it was hover-expanded
  const handleSidebarMouseLeave = () => {
    if (isHoverExpanded) {
      setIsHoverExpanded(false);
    }
  };

  // Determine rendering mode
  const showPeekStrip = !isOpen && !isHoverExpanded;
  const showSidebarAsOverlay = isHoverExpanded;

  // Layout mode is always rendered (for smooth width transitions), but with width 0 when collapsed
  const layoutModeActive = isOpen && !isHoverExpanded;

  // Calculate transform for sidebar slide
  const getTransform = (isVisible: boolean) => {
    if (isVisible) return 'translateX(0)';
    return side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
  };

  return (
    <>
      {/* BACKDROP OVERLAY - Only for hover-expanded state */}
      {showSidebarAsOverlay && (
        <div
          className="absolute inset-0 bg-black/8 backdrop-blur-[2px] pointer-events-none"
          style={{
            zIndex: 25,
            opacity: isHoverExpanded ? 1 : 0,
            transition: `opacity ${SIDEBAR_ANIMATION.backdrop.duration}ms ${SIDEBAR_ANIMATION.backdrop.easing}`,
          }}
        />
      )}

      {/* PEEK STRIP - Only shown when fully collapsed */}
      {showPeekStrip && (
        <div
          className={`
            absolute top-0 h-full
            cursor-pointer
            overflow-hidden
            bg-gradient-to-r from-cyan-500/20 to-blue-500/20
            backdrop-blur-sm
            ${side === 'left' ? 'border-r rounded-r-lg' : 'border-l rounded-l-lg'}
            border-cyan-300/50
          `}
          style={{
            [side]: '-24px', // Offset to reach window edge (compensates for parent's px-6 padding)
            width: peekWidth,
            zIndex: 20,
            opacity: isAnimating ? 0 : 1,
            willChange: 'opacity, background, box-shadow, border-color',
            transition: `
              background ${SIDEBAR_ANIMATION.peekHover.duration}ms ${SIDEBAR_ANIMATION.peekHover.easing},
              box-shadow ${SIDEBAR_ANIMATION.peekHover.duration}ms ${SIDEBAR_ANIMATION.peekHover.easing},
              border-color ${SIDEBAR_ANIMATION.peekHover.duration}ms ${SIDEBAR_ANIMATION.peekHover.easing},
              opacity ${SIDEBAR_ANIMATION.contentFade.duration}ms ${SIDEBAR_ANIMATION.contentFade.easing}
            `,
            transitionDelay: isAnimating ? '0ms' : `${STAGGER_DELAY.medium}ms`,
            background: isPeekHovered
              ? 'linear-gradient(to right, rgba(6, 182, 212, 0.4), rgba(59, 130, 246, 0.4))'
              : 'linear-gradient(to right, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
            boxShadow: isPeekHovered
              ? '0 0 20px rgba(6, 182, 212, 0.5)'
              : '0 0 0 rgba(6, 182, 212, 0)',
            borderColor: isPeekHovered
              ? 'rgba(103, 232, 249, 0.7)'
              : 'rgba(103, 232, 249, 0.5)',
          }}
          onMouseEnter={handlePeekMouseEnter}
          onMouseLeave={handlePeekMouseLeave}
        >
          {/* Vertical lines indicator with hover animation */}
          <div className="h-full flex items-center justify-center">
            <div className="flex gap-0.5">
              {[
                { height: isPeekHovered ? 10 : 8, opacity: 0.6, delay: 0 },
                { height: isPeekHovered ? 8 : 6, opacity: 0.5, delay: STAGGER_DELAY.tiny },
                { height: isPeekHovered ? 6 : 4, opacity: 0.4, delay: STAGGER_DELAY.small },
              ].map((line, index) => (
                <div
                  key={index}
                  className="w-0.5 bg-white rounded-full"
                  style={{
                    height: `${line.height * 4}px`,
                    opacity: line.opacity,
                    willChange: 'height, opacity',
                    transition: `
                      height ${SIDEBAR_ANIMATION.peekHover.duration}ms ${SIDEBAR_ANIMATION.peekHover.easing},
                      opacity ${SIDEBAR_ANIMATION.peekHover.duration}ms ${SIDEBAR_ANIMATION.peekHover.easing}
                    `,
                    transitionDelay: `${line.delay}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR AS LAYOUT (Locked Open) - Takes space in flex layout */}
      {/* Always rendered for smooth width transitions */}
      <div
        className="relative flex-shrink-0 h-full self-stretch overflow-y-auto"
        style={{
          width: layoutModeActive ? width : '0px',
          willChange: 'width',
          transition: `width ${SIDEBAR_ANIMATION.slide.duration}ms ${SIDEBAR_ANIMATION.slide.easing}`,
        }}
      >
        {/* Content wrapper with fade animation */}
        <div
          style={{
            width: width, // Fixed width for content
            height: '100%', // Required for children using h-full
            opacity: contentVisible && layoutModeActive ? 1 : 0,
            willChange: 'opacity',
            transition: `opacity ${SIDEBAR_ANIMATION.contentFade.duration}ms ${SIDEBAR_ANIMATION.contentFade.easing}`,
            transitionDelay: contentVisible && layoutModeActive ? `${STAGGER_DELAY.small}ms` : '0ms',
          }}
        >
          {children}
        </div>
      </div>

      {/* SIDEBAR AS OVERLAY (Hover-Expanded) - Absolute positioned overlay */}
      {showSidebarAsOverlay && (
        <div
          className="absolute top-0 h-full flex-shrink-0 overflow-y-auto bg-white/40 backdrop-blur-xl"
          style={{
            [side]: 0,
            width: width,
            zIndex: 30,
            transform: getTransform(isHoverExpanded),
            willChange: 'transform',
            transition: `transform ${SIDEBAR_ANIMATION.slide.duration}ms ${SIDEBAR_ANIMATION.slide.easing}`,
            // Enhanced shadow FROM the menu for depth (not across the page)
            boxShadow: side === 'left'
              ? '8px 0 32px rgba(0, 0, 0, 0.12), 4px 0 16px rgba(0, 0, 0, 0.08)'
              : '-8px 0 32px rgba(0, 0, 0, 0.12), -4px 0 16px rgba(0, 0, 0, 0.08)',
          }}
          onMouseLeave={handleSidebarMouseLeave}
        >
          {/* Content wrapper with fade animation */}
          <div
            style={{
              height: '100%', // Required for children using h-full
              opacity: contentVisible ? 1 : 0,
              willChange: 'opacity',
              transition: `opacity ${SIDEBAR_ANIMATION.contentFade.duration}ms ${SIDEBAR_ANIMATION.contentFade.easing}`,
              transitionDelay: contentVisible ? `${STAGGER_DELAY.medium}ms` : '0ms',
            }}
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
};
