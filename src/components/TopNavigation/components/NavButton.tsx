/**
 * NavButton Component
 *
 * Core navigation button component that supports all variants:
 * - tab: Navigation tabs with badges and quick actions
 * - icon: Icon-only buttons (notifications, profile)
 * - action: Action buttons (Ask Ned)
 * - menu: Menu button
 * - quick-action: Small quick action buttons
 * - search: Search button
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - React.memo to prevent re-renders when props haven't changed
 * - This is critical as NavButton is rendered in loops (tabs.map)
 */

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Pause, Play, Square } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { NAVIGATION, NAV_BUTTON_STYLES } from '../../../design-system/theme';
import { contentSpring } from '../utils/islandAnimations';
import { useReducedMotion } from '../../../lib/animations';

/**
 * Badge configuration
 */
export interface BadgeConfig {
  count: number;
  type: 'count' | 'processing' | 'status';
  status?: 'active' | 'paused';
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Quick action configuration
 */
export interface QuickActionConfig {
  type: 'default' | 'session-controls';
  onClick?: (e: React.MouseEvent) => void;
  onPause?: (e: React.MouseEvent) => void;
  onResume?: (e: React.MouseEvent) => void;
  onStop?: (e: React.MouseEvent) => void;
  isSessionActive?: boolean;
  label?: string;
}

/**
 * NavButton Props
 */
export interface NavButtonProps {
  // Variant determines the base styling
  variant: 'tab' | 'icon' | 'action' | 'menu' | 'quick-action' | 'search';

  // Content
  icon?: LucideIcon;
  label?: string;
  children?: React.ReactNode;

  // State
  isActive?: boolean;
  isHovered?: boolean;

  // Compact mode
  isCompact?: boolean;

  // Badge support
  badge?: BadgeConfig;

  // Quick action support (for tabs)
  quickAction?: QuickActionConfig;

  // Interaction
  onClick?: (e: React.MouseEvent) => void;
  onHoverChange?: (hovered: boolean) => void;

  // Additional styling
  className?: string;
  title?: string;

  // Accessibility
  'aria-label'?: string;
  'aria-expanded'?: boolean;
}

/**
 * NavButton Component
 */
function NavButtonComponent({
  variant,
  icon: Icon,
  label,
  children,
  isActive = false,
  isHovered: externalIsHovered,
  isCompact = false,
  badge,
  quickAction,
  onClick,
  onHoverChange,
  className = '',
  title,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
}: NavButtonProps) {
  // Internal hover state (if not controlled externally)
  const [internalIsHovered, setInternalIsHovered] = useState(false);
  const isHovered = externalIsHovered !== undefined ? externalIsHovered : internalIsHovered;
  const prefersReducedMotion = useReducedMotion();

  const handleMouseEnter = () => {
    setInternalIsHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setInternalIsHovered(false);
    onHoverChange?.(false);
  };

  // Calculate if we should show quick action
  const showQuickAction = quickAction && isHovered;

  // Get base classes by variant
  const getVariantClasses = () => {
    switch (variant) {
      case 'tab':
        // Explicit left padding based on compact mode
        const leftPadding = isCompact ? 'pl-2' : 'pl-4';

        // Explicit right padding based on quick action state
        const rightPadding = showQuickAction
          ? (quickAction?.type === 'session-controls' ? 'pr-24' : 'pr-14')
          : (isCompact ? 'pr-2' : 'pr-4');

        // Remove px-4 from base classes and add our explicit padding
        const tabBaseClasses = NAVIGATION.tab.base
          .replace('px-4', '')
          .replace('rounded-xl', 'rounded-full');  // Tab buttons are PILL-SHAPED with rounded-full

        // Active state styling - simplified since background is handled by animated div
        const tabStateClasses = isActive
          ? 'text-cyan-600 relative'
          : 'bg-white/50 backdrop-blur-md text-gray-600 hover:text-gray-900 hover:bg-white/80 border border-transparent hover:border-white/40';

        const compactSize = isCompact ? 'min-w-14 h-10 justify-center' : '';
        const focusStyles = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2';
        return `${tabBaseClasses} ${tabStateClasses} ${leftPadding} ${rightPadding} ${compactSize} ${focusStyles}`;

      case 'icon':
        // Icon buttons are always CIRCULAR with rounded-full
        const iconFocusStyles = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2';
        return isActive
          ? `relative flex items-center justify-center w-10 h-10 p-2 rounded-full font-medium text-sm transition-all duration-200 bg-white/95 text-cyan-600 shadow-lg border-2 border-cyan-400/60 ring-2 ring-cyan-300/40 shadow-cyan-500/30 ${iconFocusStyles}`
          : `relative flex items-center justify-center w-10 h-10 p-2 rounded-full font-medium text-sm transition-all duration-200 bg-white/50 backdrop-blur-md text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-md border border-transparent hover:border-white/40 ${iconFocusStyles}`;

      case 'action':
        const actionPadding = isCompact ? 'px-2' : 'px-4';
        const actionCompactSize = isCompact ? 'w-10 h-10 justify-center' : '';
        const actionFocusStyles = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2';
        return isActive
          ? `${NAV_BUTTON_STYLES.primary.replace('px-4', actionPadding)} flex items-center gap-2 ${actionCompactSize} ${actionFocusStyles}`
          : `${NAV_BUTTON_STYLES.default.replace('px-4', actionPadding)} flex items-center gap-2 ${actionCompactSize} ${actionFocusStyles}`;

      case 'menu':
        return `${NAV_BUTTON_STYLES.ghost} flex items-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2`;

      case 'quick-action':
        return `${NAVIGATION.quickAction.base} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1`;

      case 'search':
        const searchPadding = isCompact ? 'px-2 py-2' : 'px-3 py-2';
        const searchCompactSize = isCompact ? 'w-10 h-10 justify-center' : '';
        const searchFocusStyles = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2';
        return `flex items-center gap-2 ${searchPadding} rounded-full text-gray-600 hover:text-gray-900 bg-white/50 backdrop-blur-md hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-transparent hover:border-white/40 ${searchCompactSize} ${searchFocusStyles}`;

      default:
        return '';
    }
  };

  // Render badge
  const renderBadge = () => {
    if (!badge || badge.count === 0) return null;

    const { count, type, status, onClick: onBadgeClick } = badge;

    // Count badge (regular)
    if (type === 'count') {
      // In compact mode, position badge absolutely in top-right corner
      const badgeClasses = onBadgeClick
        ? NAVIGATION.badge.countClickable
        : NAVIGATION.badge.count;

      const compactPositioning = isCompact
        ? 'absolute -top-1 -right-1 ml-0'
        : '';

      return (
        <motion.span
          className={`${badgeClasses} ${compactPositioning}`}
          onClick={onBadgeClick}
          onKeyDown={onBadgeClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const syntheticEvent = e as unknown as React.MouseEvent;
              onBadgeClick(syntheticEvent);
            }
          } : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          role={onBadgeClick ? "button" : undefined}
          aria-label={onBadgeClick ? `${count} items` : undefined}
          whileHover={onBadgeClick && !prefersReducedMotion ? { scale: 1.1 } : undefined}
          whileTap={onBadgeClick && !prefersReducedMotion ? { scale: 0.95 } : undefined}
          transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
        >
          {count}
        </motion.span>
      );
    }

    // Processing badge (with spinner)
    if (type === 'processing') {
      // In compact mode, position badge absolutely in top-right corner
      const compactPositioning = isCompact
        ? 'absolute -top-1 -right-1 ml-0'
        : '';

      return (
        <motion.span
          onClick={onBadgeClick}
          onKeyDown={onBadgeClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const syntheticEvent = e as unknown as React.MouseEvent;
              onBadgeClick(syntheticEvent);
            }
          } : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          role={onBadgeClick ? "button" : undefined}
          aria-label={onBadgeClick ? `${count} processing items` : undefined}
          className={`${NAVIGATION.badge.processing} ${compactPositioning}`}
          whileHover={!prefersReducedMotion ? { scale: 1.1 } : undefined}
          whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
          transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          {count}
        </motion.span>
      );
    }

    // Status badge (dot)
    if (type === 'status' && status) {
      const statusClass = status === 'active'
        ? NAVIGATION.badge.statusActive
        : NAVIGATION.badge.statusPaused;

      // In compact mode, position badge absolutely in top-right corner
      const compactPositioning = isCompact
        ? 'absolute top-0 right-0 ml-0'
        : '';

      return (
        <motion.span
          onClick={onBadgeClick}
          onKeyDown={onBadgeClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const syntheticEvent = e as unknown as React.MouseEvent;
              onBadgeClick(syntheticEvent);
            }
          } : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          role={onBadgeClick ? "button" : undefined}
          aria-label="View session controls"
          className={`${statusClass} ${compactPositioning}`}
          title="View session controls"
          whileHover={!prefersReducedMotion ? { scale: 1.15 } : undefined}
          whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
          transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
        />
      );
    }

    return null;
  };

  // Render quick action
  const renderQuickAction = () => {
    if (!quickAction || !showQuickAction) return null;

    const { type, onClick: onQuickActionClick, onPause, onResume, onStop, isSessionActive } = quickAction;

    // Session controls (dual buttons)
    // Using div with role="button" to avoid nested button error
    if (type === 'session-controls') {
      return (
        <div key="session-controls" className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2 transition-all duration-200 opacity-100 scale-100">
          <motion.div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isSessionActive) {
                onPause?.(e);
              } else {
                onResume?.(e);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                const syntheticEvent = e as unknown as React.MouseEvent;
                if (isSessionActive) {
                  onPause?.(syntheticEvent);
                } else {
                  onResume?.(syntheticEvent);
                }
              }
            }}
            className={NAVIGATION.quickAction.base}
            title={isSessionActive ? 'Pause session' : 'Resume session'}
            whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
          >
            {isSessionActive ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </motion.div>
          <motion.div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStop?.(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                const syntheticEvent = e as unknown as React.MouseEvent;
                onStop?.(syntheticEvent);
              }
            }}
            className={`${NAVIGATION.quickAction.base} bg-gradient-to-r from-red-500 to-red-600`}
            title="Stop session"
            whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
          >
            <Square className="w-3.5 h-3.5" />
          </motion.div>
        </div>
      );
    }

    // Default quick action (Plus button)
    // Using div with role="button" to avoid nested button error
    return (
      <motion.div
        key="quick-action"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onQuickActionClick?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            const syntheticEvent = e as unknown as React.MouseEvent;
            onQuickActionClick?.(syntheticEvent);
          }
        }}
        className={`absolute right-2 ${NAVIGATION.quickAction.base}`}
        title={quickAction.label}
        animate={{
          top: '50%',
          y: '-50%',
          opacity: showQuickAction ? 1 : 0,
          scale: prefersReducedMotion ? 1 : (showQuickAction ? 1 : 0.95)
        }}
        whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
        whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
        style={{ pointerEvents: showQuickAction ? 'auto' : 'none' }}
      >
        <Plus className="w-3.5 h-3.5" />
      </motion.div>
    );
  };


  // Determine tooltip label (use label or aria-label)
  const tooltipLabel = label || ariaLabel || title || '';

  // Button element
  const buttonElement = (
    <motion.button
      layout="preserve-aspect"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const syntheticEvent = e as unknown as React.MouseEvent;
          onClick?.(syntheticEvent);
        }
      }}
      className={`relative ${getVariantClasses()} ${className}`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      title={isCompact ? undefined : title}
      aria-label={isCompact ? tooltipLabel : ariaLabel}
      aria-expanded={ariaExpanded}
      whileHover={!prefersReducedMotion && (variant === 'tab' || variant === 'search') ? { scale: 1.02 } : undefined}
      whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
      transition={prefersReducedMotion ? { duration: 0 } : {
        ...contentSpring,
        layout: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
      }}
    >
      {/* Animated active background - smoothly transitions between tabs */}
      {variant === 'tab' && isActive && (
        <motion.div
          layoutId="activeTabBackground"
          className="absolute inset-0 bg-white/95 backdrop-blur-lg rounded-full border-2 border-cyan-400/60 ring-2 ring-cyan-300/40 shadow-lg shadow-cyan-500/30"
          initial={prefersReducedMotion ? { scale: 1 } : { scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : {
            type: "spring",
            stiffness: 380,
            damping: 30,
          }}
          style={{ zIndex: -1 }}
        />
      )}

      {/* Icon */}
      {Icon && <Icon className={variant === 'icon' || variant === 'action' || variant === 'menu' ? 'w-5 h-5' : 'w-4 h-4'} />}

      {/* Label with AnimatePresence for smooth fade out */}
      <AnimatePresence mode="wait" initial={false}>
        {label && !isCompact && (
          <motion.span
            key="label"
            layout="position"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={prefersReducedMotion ? { duration: 0 } : {
              opacity: { duration: 0.25, ease: 'easeInOut' },
              scale: { duration: 0.25, ease: 'easeInOut' },
              layout: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
            }}
            className={variant === 'action' || variant === 'menu' ? 'font-semibold text-sm' : ''}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Custom children */}
      {children}

      {/* Badge */}
      {renderBadge()}

      {/* Quick action */}
      <AnimatePresence>
        {renderQuickAction()}
      </AnimatePresence>
    </motion.button>
  );

  return (
    <div className="group flex items-center" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {isCompact && tooltipLabel ? (
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={300}>
            <Tooltip.Trigger asChild>
              {buttonElement}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="z-50 px-3 py-1.5 text-sm text-white bg-gray-900 rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95"
                sideOffset={5}
              >
                {tooltipLabel}
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : (
        buttonElement
      )}
    </div>
  );
}

/**
 * PERFORMANCE OPTIMIZATION:
 * Memoize the component to prevent unnecessary re-renders.
 * NavButton is rendered in a loop (tabs.map), so any parent re-render
 * would re-render all buttons without memoization.
 */
export const NavButton = memo(NavButtonComponent);
