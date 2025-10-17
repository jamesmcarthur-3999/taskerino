/**
 * SessionStartCountdown
 *
 * Beautiful full-screen countdown modal shown when starting a session
 * Features:
 * - 3 → 2 → 1 → Recording! countdown
 * - Glassmorphism backdrop
 * - Smooth scale + fade animations
 * - Pulsing circle with gradient
 * - Session name display
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

interface SessionStartCountdownProps {
  countdown: number | null;
  sessionName: string;
}

export function SessionStartCountdown({ countdown, sessionName }: SessionStartCountdownProps) {
  const [animate, setAnimate] = useState(false);

  // Trigger animation when countdown changes
  useEffect(() => {
    if (countdown !== null) {
      setAnimate(false);
      // Small delay to allow CSS transition to reset
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
        });
      });
    }
  }, [countdown]);

  if (countdown === null) return null;

  const isRecording = countdown === 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="flex flex-col items-center gap-8">
        {/* Countdown Circle */}
        <div className="relative">
          {/* Outer glow ring - pulses */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-600/30 blur-2xl transition-all duration-500 ${
              animate ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
            }`}
          />

          {/* Main countdown circle */}
          <div
            className={`relative w-64 h-64 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl transition-all duration-500 ${
              animate ? 'scale-110' : 'scale-95'
            } ${isRecording ? 'animate-pulse' : ''}`}
            style={{
              boxShadow: '0 0 60px rgba(6, 182, 212, 0.5), 0 0 120px rgba(37, 99, 235, 0.3)',
            }}
          >
            {/* Inner glow */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

            {/* Number or checkmark */}
            <div
              className={`transition-all duration-300 ${
                animate ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              {isRecording ? (
                <CheckCircle2 size={120} className="text-white drop-shadow-lg" />
              ) : (
                <span className="text-[140px] font-bold text-white drop-shadow-lg leading-none">
                  {countdown}
                </span>
              )}
            </div>
          </div>

          {/* Ripple effect circles */}
          {!isRecording && (
            <>
              <div
                className="absolute inset-0 rounded-full border-4 border-cyan-400/40 animate-ping"
                style={{ animationDuration: '2s' }}
              />
              <div
                className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping"
                style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
              />
            </>
          )}
        </div>

        {/* Text */}
        <div
          className={`text-center transition-all duration-500 ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-white text-2xl font-semibold mb-3">
            {isRecording ? 'Recording!' : 'Starting session...'}
          </p>
          <p className="text-white/90 text-xl font-medium px-8">
            "{sessionName}"
          </p>
        </div>

        {/* Particles effect (subtle sparkles) */}
        {isRecording && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  opacity: Math.random() * 0.6 + 0.2,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
