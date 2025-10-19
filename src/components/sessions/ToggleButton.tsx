/**
 * ToggleButton Component
 *
 * Elegant glassmorphism toggle control for session settings.
 * Used for screenshot/audio controls in active session card.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideProps } from 'lucide-react';

interface ToggleButtonProps {
  icon: React.ComponentType<LucideProps>;
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ToggleButton = React.memo(function ToggleButton({
  icon: Icon,
  label,
  active,
  onChange,
  disabled = false,
  size = 'md',
  showLabel = true,
}: ToggleButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 gap-1.5',
    md: 'px-4 py-2.5 gap-2',
    lg: 'px-5 py-3 gap-2.5',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Calculate margin based on size for smooth label animation
  const labelMargin = size === 'sm' ? 6 : size === 'md' ? 8 : 10;

  return (
    <motion.button
      layout
      onClick={(e) => {
        console.log(`🔘 [TOGGLE BUTTON ${label}] onClick fired - disabled: ${disabled}, active: ${active}`);
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          console.log(`🔘 [TOGGLE BUTTON ${label}] Calling onChange with: ${!active}`);
          onChange(!active);
        } else {
          console.log(`🔘 [TOGGLE BUTTON ${label}] Button is disabled, not calling onChange`);
        }
      }}
      disabled={disabled}
      className={`
        flex items-center rounded-full font-semibold
        transition-all duration-300 transform
        ${active
          ? 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 backdrop-blur-md text-white shadow-lg shadow-cyan-500/20 scale-105'
          : 'bg-white/50 backdrop-blur-sm text-gray-700 hover:bg-white/70 border-2 border-white/60'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}
      `}
      style={{
        paddingLeft: size === 'sm' ? '12px' : size === 'md' ? '16px' : '20px',
        paddingRight: size === 'sm' ? '12px' : size === 'md' ? '16px' : '20px',
        paddingTop: size === 'sm' ? '6px' : size === 'md' ? '10px' : '12px',
        paddingBottom: size === 'sm' ? '6px' : size === 'md' ? '10px' : '12px',
      }}
      transition={{
        layout: {
          type: "spring",
          stiffness: 400,
          damping: 28,
        }
      }}
      title={`${active ? 'Disable' : 'Enable'} ${label}`}
    >
      {/* Icon with position animation */}
      <motion.div layout="position">
        <Icon
          size={iconSizes[size]}
          className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}
        />
      </motion.div>

      {/* Label with smooth width/opacity animation */}
      <AnimatePresence mode="wait" initial={false}>
        {showLabel && (
          <motion.span
            key="label"
            className={textSizes[size]}
            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
            animate={{
              opacity: 1,
              width: 'auto',
              marginLeft: `${labelMargin}px`,
              transition: {
                type: "spring",
                stiffness: 400,
                damping: 28,
              }
            }}
            exit={{
              opacity: 0,
              width: 0,
              marginLeft: 0,
              transition: {
                type: "spring",
                stiffness: 500,
                damping: 32,
              }
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Active indicator dot with scale animation */}
      <AnimatePresence>
        {active && showLabel && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: {
                type: "spring",
                stiffness: 500,
                damping: 25,
              }
            }}
            exit={{
              opacity: 0,
              scale: 0,
              transition: {
                type: "spring",
                stiffness: 600,
                damping: 30,
              }
            }}
            className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-lg ml-1.5"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
});
