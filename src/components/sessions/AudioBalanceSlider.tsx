import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Volume2 } from 'lucide-react';

interface AudioBalanceSliderProps {
  balance: number; // 0-100: 0 = mic only, 50 = balanced, 100 = system audio only
  onChange: (balance: number) => void;
  disabled?: boolean;
  showLabels?: boolean;
}

/**
 * AudioBalanceSlider - Draggable slider for mixing microphone and system audio
 *
 * Features:
 * - Gradient track from red (mic) through purple (balanced) to cyan (system audio)
 * - Draggable thumb with Framer Motion animations
 * - Keyboard controls (arrow keys, Home/End)
 * - Live value display (percentage or "Balanced")
 * - Accessibility (ARIA labels, screen reader support)
 */
export function AudioBalanceSlider({
  balance,
  onChange,
  disabled = false,
  showLabels = true,
}: AudioBalanceSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Handle mouse/touch dragging
  const handleDrag = (clientX: number) => {
    if (!trackRef.current || disabled) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

    onChange(Math.round(percentage));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleDrag(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleDrag(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDrag(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleDrag(e.touches[0].clientX);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    let newBalance = balance;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newBalance = Math.max(0, balance - 5);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newBalance = Math.min(100, balance + 5);
        break;
      case 'Home':
        e.preventDefault();
        newBalance = 0;
        break;
      case 'End':
        e.preventDefault();
        newBalance = 100;
        break;
      default:
        return;
    }

    onChange(newBalance);
  };

  // Calculate mix description
  const getMixDescription = () => {
    if (balance === 0) return 'Mic Only';
    if (balance === 100) return 'System Only';
    if (balance >= 45 && balance <= 55) return 'Balanced';
    if (balance < 45) return `${100 - balance}% Mic`;
    return `${balance}% System`;
  };

  return (
    <div className="space-y-2">
      {/* Labels */}
      {showLabels && (
        <div className="flex items-center justify-between text-xs font-medium text-gray-700">
          <div className="flex items-center gap-1">
            <Mic size={12} className="text-red-500" />
            <span>Microphone</span>
          </div>
          <div className="flex items-center gap-1">
            <span>System Audio</span>
            <Volume2 size={12} className="text-cyan-500" />
          </div>
        </div>
      )}

      {/* Slider Track */}
      <div
        ref={trackRef}
        className={`relative h-3 rounded-full bg-gradient-to-r from-red-500 via-purple-500 to-cyan-500 shadow-inner ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="slider"
        aria-label="Audio balance slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={balance}
        aria-valuetext={getMixDescription()}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
      >
        {/* Draggable Thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-gray-300 cursor-grab active:cursor-grabbing"
          style={{
            left: `${balance}%`,
            x: '-50%',
          }}
          animate={{
            scale: isDragging ? 1.2 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 25,
          }}
        >
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
          </div>
        </motion.div>
      </div>

      {/* Live Value Display */}
      <div className="text-center">
        <div className="text-xs font-bold text-gray-900">{getMixDescription()}</div>
        <div className="text-[10px] text-gray-500">{balance}%</div>
      </div>
    </div>
  );
}
