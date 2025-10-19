import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideProps } from 'lucide-react';

interface DropdownTriggerProps {
  label: string;
  icon: React.ComponentType<LucideProps>;
  active: boolean;
  onClick: () => void;
  badge?: number;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function DropdownTrigger({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  disabled = false,
  className = '',
  showLabel = true,
}: DropdownTriggerProps) {
  return (
    <motion.button
      layout
      onClick={onClick}
      disabled={disabled}
      className={`
        backdrop-blur-sm border-2 rounded-full text-sm font-semibold
        transition-all flex items-center
        ${active
          ? 'bg-cyan-100 border-cyan-400 text-cyan-800'
          : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-cyan-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none
        ${className}
      `.trim()}
      style={{
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: '8px',
        paddingBottom: '8px',
      }}
      transition={{
        layout: {
          type: "spring",
          stiffness: 400,
          damping: 28,
        }
      }}
      title={label}
    >
      {/* Icon with position animation */}
      <motion.div layout="position">
        <Icon size={16} />
      </motion.div>

      {/* Label with smooth width/opacity animation */}
      <AnimatePresence mode="wait" initial={false}>
        {showLabel && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
            animate={{
              opacity: 1,
              width: 'auto',
              marginLeft: '8px',
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

      {/* Badge with scale animation */}
      <AnimatePresence>
        {badge !== undefined && badge > 0 && (
          <motion.span
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
                duration: 0.15,
              }
            }}
            className="ml-1 px-1.5 py-0.5 bg-cyan-500 text-white rounded-full text-[10px] font-bold"
          >
            {badge}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
