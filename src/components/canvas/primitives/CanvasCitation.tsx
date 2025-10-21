/**
 * CanvasCitation - Source Citation Component
 *
 * Displays references to original session data (screenshots, audio, video) that support
 * claims made in the Canvas. Uses a hybrid display approach:
 * - Default: Subtle link icon with citation count
 * - Hover: Popover showing preview (excerpt, timestamp, type)
 * - Click: Navigate to Review tab at that exact moment
 */

import React, { useState } from 'react';
import { Link2, Camera, Mic, Video, Clock } from 'lucide-react';
import type { SourceCitation } from '../../../types';
import { useCanvasNavigation } from '../../../context/CanvasNavigationContext';

interface CanvasCitationProps {
  citations: SourceCitation[];
  variant?: 'inline' | 'block' | 'superscript';
  className?: string;
}

/**
 * Convert number to Unicode superscript (1-9 supported, 10+ uses [n] format)
 */
function toSuperscript(num: number): string {
  if (num <= 0) return '';
  if (num >= 10) return `[${num}]`;

  const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return num.toString().split('').map(d => superscripts[parseInt(d)]).join('');
}

export function CanvasCitation({ citations, variant = 'superscript', className = '' }: CanvasCitationProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { navigateToSource } = useCanvasNavigation();

  if (!citations || citations.length === 0) {
    return null;
  }

  // Get icon for citation type
  const getCitationIcon = (type: SourceCitation['type']) => {
    switch (type) {
      case 'screenshot':
        return <Camera className="w-3 h-3" />;
      case 'audio':
        return <Mic className="w-3 h-3" />;
      case 'video':
        return <Video className="w-3 h-3" />;
      case 'agent_analysis':
        return <Link2 className="w-3 h-3" />;
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Get type label
  const getTypeLabel = (type: SourceCitation['type']): string => {
    switch (type) {
      case 'screenshot':
        return 'Screenshot';
      case 'audio':
        return 'Audio';
      case 'video':
        return 'Video';
      case 'agent_analysis':
        return 'AI Analysis';
    }
  };

  const handleClick = (citation: SourceCitation) => {
    navigateToSource(citation);
  };

  if (variant === 'block') {
    // Block variant - show each citation as a card
    return (
      <div className={`space-y-2 ${className}`}>
        {citations.map((citation, index) => (
          <button
            key={index}
            onClick={() => handleClick(citation)}
            className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5 text-blue-600">
                {getCitationIcon(citation.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-blue-900">
                    {citation.label || getTypeLabel(citation.type)}
                  </span>
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(citation.timestamp)}
                  </span>
                </div>
                {citation.excerpt && (
                  <p className="text-xs text-blue-700 line-clamp-2">
                    "{citation.excerpt}"
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Superscript variant - academic style inline footnotes
  if (variant === 'superscript') {
    return (
      <span
        className={`relative inline-flex ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Superscript citation numbers - clickable */}
        <sup
          onClick={() => handleClick(citations[0])}
          className="text-blue-600 hover:text-blue-800 cursor-pointer font-normal text-xs ml-0.5 transition-colors"
          title={`${citations.length} source${citations.length > 1 ? 's' : ''} - click to view`}
        >
          {citations.map((_, i) => toSuperscript(i + 1)).join('')}
        </sup>

        {/* Hover Popover - same as inline variant */}
        {isHovered && (
          <div className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-white border-2 border-blue-200 rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-bottom-2">
            {/* Arrow pointer */}
            <div className="absolute -bottom-2 left-2 w-4 h-4 bg-white border-r-2 border-b-2 border-blue-200 transform rotate-45" />

            <div className="relative space-y-2">
              <div className="text-xs font-semibold text-gray-700 mb-2">
                {citations.length === 1 ? 'Source' : `${citations.length} Sources`}
              </div>

              {citations.slice(0, 3).map((citation, index) => (
                <button
                  key={index}
                  onClick={() => handleClick(citation)}
                  className="w-full text-left flex items-start gap-2 p-2 hover:bg-gray-50 rounded transition-colors cursor-pointer group"
                >
                  <div className="flex-shrink-0 mt-0.5 text-blue-600">
                    {getCitationIcon(citation.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-900">
                        {citation.label || getTypeLabel(citation.type)}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(citation.timestamp)}
                      </span>
                    </div>
                    {citation.excerpt && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        "{citation.excerpt}"
                      </p>
                    )}
                    <div className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                      Click to view in Review →
                    </div>
                  </div>
                </button>
              ))}

              {citations.length > 3 && (
                <div className="text-xs text-gray-500 text-center pt-1 border-t border-gray-200">
                  +{citations.length - 3} more sources
                </div>
              )}
            </div>
          </div>
        )}
      </span>
    );
  }

  // Inline variant - compact badge with hover preview
  if (variant === 'inline') {
    return (
      <div
        className={`relative inline-flex ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Badge - always visible */}
        <button
          onClick={() => handleClick(citations[0])} // Click navigates to first citation
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-md text-xs font-medium text-blue-700 transition-colors cursor-pointer"
        >
          <Link2 className="w-3 h-3" />
          {citations.length > 1 && <span>{citations.length}</span>}
        </button>

        {/* Hover Popover */}
        {isHovered && (
          <div className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-white border-2 border-blue-200 rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-bottom-2">
            {/* Arrow pointer */}
            <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white border-r-2 border-b-2 border-blue-200 transform rotate-45" />

            <div className="relative space-y-2">
              <div className="text-xs font-semibold text-gray-700 mb-2">
                {citations.length === 1 ? 'Source' : `${citations.length} Sources`}
              </div>

              {citations.slice(0, 3).map((citation, index) => (
                <button
                  key={index}
                  onClick={() => handleClick(citation)}
                  className="w-full text-left flex items-start gap-2 p-2 hover:bg-gray-50 rounded transition-colors cursor-pointer group"
                >
                  <div className="flex-shrink-0 mt-0.5 text-blue-600">
                    {getCitationIcon(citation.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-900">
                        {citation.label || getTypeLabel(citation.type)}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(citation.timestamp)}
                      </span>
                    </div>
                    {citation.excerpt && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        "{citation.excerpt}"
                      </p>
                    )}
                    <div className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                      Click to view in Review →
                    </div>
                  </div>
                </button>
              ))}

              {citations.length > 3 && (
                <div className="text-xs text-gray-500 text-center pt-1 border-t border-gray-200">
                  +{citations.length - 3} more sources
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Block variant - explicit (unchanged)
  return null;
}
