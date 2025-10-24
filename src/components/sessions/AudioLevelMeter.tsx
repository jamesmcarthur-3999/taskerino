import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

interface AudioLevelMeterProps {
  label: string;
  deviceId?: string;
  muted?: boolean;
  compact?: boolean;
}

interface AudioLevelData {
  deviceType: string;
  deviceId?: string;
  rms: number;
  peak: number;
  levelPercent: number;
}

/**
 * AudioLevelMeter - Visual audio level indicator with animated bars
 *
 * Features:
 * - Real-time level visualization from actual audio capture
 * - Color-coded bars: green (safe), yellow (approaching max), red (clipping)
 * - Peak hold indicator (shows recent max)
 * - Smooth animations with Framer Motion
 * - Compact mode for inline display
 *
 * Listens to Tauri "audio-level" events emitted from Rust audio capture module
 */
export const AudioLevelMeter = React.memo(function AudioLevelMeter({
  label,
  deviceId,
  muted = false,
  compact = false,
}: AudioLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const lastPeakTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (muted || !deviceId) {
      setLevel(0);
      setPeak(0);
      return;
    }

    let unlisten: UnlistenFn | undefined;

    // Listen for audio-level events from Rust
    const setupListener = async () => {
      unlisten = await listen<AudioLevelData>('audio-level', (event) => {
        const data = event.payload;

        // Filter by device type (label is "Microphone" or "System Audio")
        const deviceType = label.toLowerCase().includes('microphone')
          ? 'microphone'
          : 'system-audio';

        if (data.deviceType === deviceType) {
          // Convert RMS (0.0-1.0) to percentage (0-100)
          const levelPercent = Math.min(100, data.levelPercent);
          setLevel(levelPercent);

          // Update peak with hold
          const peakPercent = Math.min(100, data.peak * 100);
          setPeak((prevPeak) => {
            const now = Date.now();
            if (peakPercent > prevPeak) {
              lastPeakTimeRef.current = now;
              return peakPercent;
            }
            // Decay peak after 1 second
            if (now - lastPeakTimeRef.current > 1000) {
              return Math.max(0, prevPeak - 2);
            }
            return prevPeak;
          });
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [deviceId, muted, label]);

  // Calculate bar color based on level
  const getBarColor = (currentLevel: number) => {
    if (currentLevel > 85) return 'bg-red-500'; // Clipping
    if (currentLevel > 70) return 'bg-yellow-500'; // Warning
    return 'bg-gradient-to-r from-green-400 to-cyan-500'; // Safe
  };

  // Calculate opacity for bar segments (creates multiple bar effect)
  const renderBars = () => {
    const barCount = compact ? 20 : 40;
    const bars = [];

    for (let i = 0; i < barCount; i++) {
      const barThreshold = (i / barCount) * 100;
      const isActive = level >= barThreshold;
      const isPeakBar = peak >= barThreshold && peak < barThreshold + (100 / barCount);

      bars.push(
        <div
          key={i}
          className={`
            ${compact ? 'h-2 w-0.5' : 'h-3 w-1'}
            rounded-full transition-opacity duration-75
            ${isActive ? getBarColor(barThreshold) : 'bg-gray-300'}
            ${isPeakBar ? 'ring-2 ring-white' : ''}
            ${isActive ? 'opacity-100' : 'opacity-30'}
          `}
        />
      );
    }

    return bars;
  };

  if (muted) {
    return (
      <div className={`${compact ? 'space-y-0.5' : 'space-y-2'}`}>
        <div className="flex items-center justify-between">
          <span className={`font-medium text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
            {label}
          </span>
          <span className="text-xs text-gray-400 italic">Muted</span>
        </div>
        <div className={`flex gap-0.5 ${compact ? 'h-2' : 'h-3'} bg-gray-100 rounded-full px-1`}>
          {/* Empty bars */}
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'space-y-0.5' : 'space-y-2'}`}>
      <div className="flex items-center justify-between">
        <span className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
          {label}
        </span>
        <span className={`font-mono font-bold ${compact ? 'text-xs' : 'text-sm'} ${
          level > 85 ? 'text-red-600' : level > 70 ? 'text-yellow-600' : 'text-cyan-600'
        }`}>
          {Math.round(level)}%
        </span>
      </div>

      <div className={`flex gap-0.5 ${compact ? 'h-2' : 'h-3'} bg-gray-100/50 rounded-full p-1`}>
        {renderBars()}
      </div>

      {!compact && (
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>0%</span>
          <span className="text-yellow-600">70%</span>
          <span className="text-red-600">85%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
});
