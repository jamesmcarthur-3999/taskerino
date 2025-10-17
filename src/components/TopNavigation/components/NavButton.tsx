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
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, Pause, Play, Square } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
export function NavButton({
  variant,
  icon: Icon,
  label,
  children,
  isActive = false,
  isHovered: externalIsHovered,
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
  const showQuickAction = quickAction && (isActive || isHovered);

  // Don't add padding-right - let quick actions overlap with right edge naturally
  const getQuickActionPadding = () => {
    return '';
  };

  // Get base classes by variant
  const getVariantClasses = () => {
    switch (variant) {
      case 'tab':
        const tabBaseClasses = NAVIGATION.tab.base;
        const tabStateClasses = isActive ? NAVIGATION.tab.active : NAVIGATION.tab.inactive;
        return `${tabBaseClasses} ${tabStateClasses} ${getQuickActionPadding()}`;

      case 'icon':
        return isActive
          ? `${NAV_BUTTON_STYLES.default} bg-white/90 text-cyan-600 shadow-cyan-200/40`
          : NAV_BUTTON_STYLES.default;

      case 'action':
        return isActive
          ? `${NAV_BUTTON_STYLES.primary} flex items-center gap-2`
          : `${NAV_BUTTON_STYLES.default} flex items-center gap-2`;

      case 'menu':
        return `${NAV_BUTTON_STYLES.ghost} flex items-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 text-gray-800`;

      case 'quick-action':
        return NAVIGATION.quickAction.base;

      case 'search':
        return 'flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 hover:text-gray-900 bg-white/50 backdrop-blur-md hover:bg-white/80 hover:shadow-md transition-all duration-200 border border-transparent hover:border-white/40';

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
      const badgeClasses = onBadgeClick
        ? NAVIGATION.badge.countClickable
        : NAVIGATION.badge.count;

      return (
        <motion.span
          className={badgeClasses}
          onClick={onBadgeClick}
          onKeyDown={onBadgeClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBadgeClick(e as any);
            }
          } : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          role={onBadgeClick ? "button" : undefined}
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
      return (
        <motion.span
          onClick={onBadgeClick}
          onKeyDown={onBadgeClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBadgeClick(e as any);
            }
          } : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          role={onBadgeClick ? "button" : undefined}
          className={NAVIGATION.badge.processing}
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

      return (
        <motion.span
          onClick={onBadgeClick}
          onKeyDown={onBadgeClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBadgeClick(e as any);
            }
          } : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          role={onBadgeClick ? "button" : undefined}
          className={statusClass}
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
    if (type === 'session-controls') {
      return (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2 transition-all duration-200 opacity-100 scale-100">
          <motion.button
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
                if (isSessionActive) {
                  onPause?.(e as any);
                } else {
                  onResume?.(e as any);
                }
              }
            }}
            className={NAVIGATION.quickAction.base}
            title={isSessionActive ? 'Pause session' : 'Resume session'}
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
          >
            {isSessionActive ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </motion.button>
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStop?.(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onStop?.(e as any);
              }
            }}
            className={`${NAVIGATION.quickAction.base} bg-gradient-to-r from-red-500 to-red-600`}
            title="Stop session"
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
          >
            <Square className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      );
    }

    // Default quick action (Plus button)
    return (
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onQuickActionClick?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onQuickActionClick?.(e as any);
          }
        }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 ${NAVIGATION.quickAction.base}`}
        title={quickAction.label}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={prefersReducedMotion ? { opacity: showQuickAction ? 1 : 0 } : { opacity: showQuickAction ? 1 : 0, scale: showQuickAction ? 1 : 0.9 }}
        whileHover={!prefersReducedMotion ? { scale: 1.05 } : undefined}
        whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
        style={{ pointerEvents: showQuickAction ? 'auto' : 'none' }}
      >
        <Plus className="w-3.5 h-3.5" />
      </motion.button>
    );
  };

  // Render active indicator (for tabs)
  const renderActiveIndicator = () => {
    if (variant !== 'tab' || !isActive) return null;

    return (
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
        layoutId="activeTabIndicator"
        transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
      />
    );
  };

  return (
    <div className="group flex items-center" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <motion.button
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(e as any);
          }
        }}
        className={`relative ${getVariantClasses()} ${className}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        title={title}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        whileHover={!prefersReducedMotion && (variant === 'tab' || variant === 'search') ? { scale: 1.02 } : undefined}
        whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
        transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
      >
        {/* Icon */}
        {Icon && <Icon className={variant === 'icon' || variant === 'action' || variant === 'menu' ? 'w-5 h-5' : 'w-4 h-4'} />}

        {/* Label */}
        {label && <span className={variant === 'action' || variant === 'menu' ? 'font-semibold text-sm' : ''}>{label}</span>}

        {/* Custom children */}
        {children}

        {/* Badge */}
        {renderBadge()}

        {/* Active indicator */}
        {renderActiveIndicator()}

        {/* Quick action */}
        {renderQuickAction()}
      </motion.button>
    </div>
  );
}
