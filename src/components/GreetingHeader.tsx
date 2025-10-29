/**
 * GreetingHeader Component
 *
 * Displays time-based greeting ("Good morning/afternoon/evening") with inline editable name field.
 * When name is empty, shows a subtle glow to invite interaction.
 *
 * Features:
 * - Time-based greeting logic (morning: 5am-12pm, afternoon: 12pm-6pm, evening: 6pm-5am)
 * - Inline name editing (click to edit when name exists)
 * - Auto-save on blur or Enter key press
 * - Input validation using validateName() from utils
 * - Glassmorphism styling matching app aesthetic
 * - Smooth animations with Framer Motion
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';
import { validateName } from '../utils/validation';
import { getGlassClasses } from '../design-system/theme';

interface GreetingHeaderProps {
  className?: string;
}

/**
 * Get time-based greeting
 * Morning: 5am-12pm
 * Afternoon: 12pm-6pm
 * Evening: 6pm-5am (next day)
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

export function GreetingHeader({ className = '' }: GreetingHeaderProps) {
  const { state, dispatch } = useSettings();
  const userName = state.userProfile.name;

  // Local state
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>(getTimeOfDay());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputWidth, setInputWidth] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Update time of day every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Measure input width based on content
  useEffect(() => {
    if (measureRef.current) {
      const width = measureRef.current.offsetWidth;
      setInputWidth(width);
    }
  }, [editValue, userName, isEditing]);

  // Handle click to edit (when name exists)
  const handleClick = () => {
    if (userName && !isEditing) {
      setEditValue(userName);
      setError(null);
      setIsEditing(true);
    }
  };

  // Handle save
  const handleSave = () => {
    const trimmedValue = editValue.trim();

    // Validate name
    const validation = validateName(trimmedValue);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid name');
      return;
    }

    // Save to context
    dispatch({
      type: 'UPDATE_USER_PROFILE',
      payload: { name: trimmedValue }
    });

    setIsEditing(false);
    setError(null);
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setError(null);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Handle blur (auto-save)
  const handleBlur = () => {
    if (editValue.trim() === '') {
      handleCancel();
    } else {
      handleSave();
    }
  };

  return (
    <div className={`${className}`}>
      {/* Hidden measurement span - always rendered to measure text width */}
      <span
        ref={measureRef}
        className="text-5xl md:text-6xl font-semibold absolute opacity-0 pointer-events-none whitespace-pre"
        aria-hidden="true"
      >
        {isEditing ? editValue || 'enter your name' : userName || 'enter your name'}
      </span>

      <AnimatePresence mode="wait">
        {!userName && !isEditing ? (
          // Empty state: Show input with placeholder and glow
          <motion.div
            key="empty-input"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <span className="text-5xl md:text-6xl font-light text-gray-700/90">
              Good {timeOfDay},{' '}
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    setEditValue(e.target.value);
                    setError(null);
                  }
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={() => setIsEditing(true)}
                placeholder="enter your name"
                className={`text-5xl md:text-6xl font-semibold text-gray-800 bg-transparent placeholder:text-gray-400/50 ${!isEditing ? 'animate-pulse' : ''}`}
                style={{
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  padding: 0,
                  margin: 0,
                  width: `${inputWidth}px`,
                  minWidth: '200px',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
              />
            </span>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 mt-2 ml-1"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        ) : isEditing ? (
          // Edit mode: Inline input (flows naturally with greeting text)
          <motion.div
            key="editing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <span className="text-5xl md:text-6xl font-light text-gray-700/90">
              Good {timeOfDay},{' '}
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => {
                  if (e.target.value.length <= 30) {
                    setEditValue(e.target.value);
                    setError(null);
                  }
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="text-5xl md:text-6xl font-semibold text-gray-800 bg-transparent caret-cyan-500"
                style={{
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  padding: 0,
                  margin: 0,
                  width: `${inputWidth}px`,
                  minWidth: '200px',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
              />
            </span>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 mt-1 ml-1"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        ) : (
          // Display mode: Show greeting with name (flows naturally, clickable)
          <motion.div
            key="display"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={handleClick}
            className="cursor-pointer group"
          >
            <span className="text-5xl md:text-6xl font-light text-gray-700/90 transition-opacity duration-300 group-hover:opacity-80">
              Good {timeOfDay},{' '}
              <span className="font-semibold text-gray-800 group-hover:text-cyan-600 transition-colors duration-300 whitespace-nowrap inline-block">
                {userName}
              </span>
            </span>

            {/* Edit hint on hover */}
            <motion.p
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="text-xs text-gray-500/70 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              Click to edit
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
