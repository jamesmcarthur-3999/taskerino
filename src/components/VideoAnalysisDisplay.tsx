/**
 * VideoAnalysisDisplay
 *
 * Shows analyzed video frames in a compact, visually appealing format.
 * Options: filmstrip or grid display modes.
 */

import React, { useState } from 'react';
import { Film, Grid, List } from 'lucide-react';
import type { VideoFrame } from '../types';

interface VideoAnalysisDisplayProps {
  frames: VideoFrame[];
  timeRange: { start: number; end: number };
}

export function VideoAnalysisDisplay({ frames, timeRange }: VideoAnalysisDisplayProps) {
  const [displayMode, setDisplayMode] = useState<'filmstrip' | 'grid'>('filmstrip');

  if (frames.length === 0) return null;

  return (
    <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-4 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">
            Analyzed Frames ({frames.length})
          </span>
          <span className="text-xs text-gray-500">
            {formatTime(timeRange.start)} - {formatTime(timeRange.end)}
          </span>
        </div>

        {/* Display mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setDisplayMode('filmstrip')}
            className={`p-1.5 rounded ${
              displayMode === 'filmstrip' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400'
            }`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setDisplayMode('grid')}
            className={`p-1.5 rounded ${
              displayMode === 'grid' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400'
            }`}
          >
            <Grid size={14} />
          </button>
        </div>
      </div>

      {/* Filmstrip Mode */}
      {displayMode === 'filmstrip' && (
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {frames.map((frame, i) => (
            <div key={i} className="flex-shrink-0">
              <div className="relative group">
                <img
                  src={frame.dataUri}
                  alt={`Frame at ${formatTime(frame.timestamp)}`}
                  className="w-32 h-18 object-cover rounded border border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                />
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {formatTime(frame.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid Mode */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-3 gap-2">
          {frames.map((frame, i) => (
            <div key={i} className="relative group">
              <img
                src={frame.dataUri}
                alt={`Frame at ${formatTime(frame.timestamp)}`}
                className="w-full h-auto object-cover rounded border border-gray-300 shadow-sm hover:shadow-md transition-shadow"
              />
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                {formatTime(frame.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
