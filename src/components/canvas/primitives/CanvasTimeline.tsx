/**
 * CanvasTimeline - Data Display Component
 *
 * Chronological event visualization with vertical or horizontal orientation.
 * Supports theming, icons, screenshots, and interactive navigation.
 */

import React from 'react';
import type { TimelineProps } from '../types';
import { CANVAS_COMPONENTS, TYPOGRAPHY } from '../../../design-system/theme';
import { CanvasCitation } from './CanvasCitation';

/**
 * Process markdown in text content (auto-detect if content contains markdown)
 */
function processMarkdown(content: string): { isMarkdown: boolean; html?: string } {
  // Auto-detect markdown patterns
  const hasMarkdown = /[`*]/.test(content);

  if (!hasMarkdown) {
    return { isMarkdown: false };
  }

  // Escape HTML first to prevent XSS
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Apply markdown transformations
  const html = escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, `<code class="px-1.5 py-0.5 bg-gray-100 rounded ${TYPOGRAPHY.body.small} font-mono text-gray-800">$1</code>`);

  return { isMarkdown: true, html };
}

export function CanvasTimeline({
  items,
  orientation = 'vertical',
  showTimestamps = true,
  interactive = false,
}: TimelineProps) {
  // Format timestamp (seconds or ISO string)
  const formatTimestamp = (timestamp: string | number): string => {
    if (typeof timestamp === 'number') {
      // Convert seconds to MM:SS
      const mins = Math.floor(timestamp / 60);
      const secs = Math.floor(timestamp % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    // ISO string - show time only
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (orientation === 'horizontal') {
    // Horizontal timeline (scroll horizontally)
    return (
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start gap-0 min-w-max">
          {items.map((item, index) => {
            const themeClasses = CANVAS_COMPONENTS.themes[item.theme || 'default'];
            const isLast = index === items.length - 1;

            return (
              <div key={item.id} className="flex items-start">
                {/* Event card */}
                <div className="flex flex-col items-center min-w-[200px] max-w-[250px]">
                  {/* Dot */}
                  <div
                    className={`w-4 h-4 rounded-full border-4 ${themeClasses.border} bg-white z-10`}
                  />

                  {/* Content */}
                  <div className={`mt-3 p-3 ${themeClasses.bg} border-2 ${themeClasses.border} rounded-lg w-full`}>
                    {showTimestamps && (
                      <div className={`text-xs ${themeClasses.textSecondary} mb-1 font-medium`}>
                        {formatTimestamp(item.timestamp)}
                      </div>
                    )}
                    <div className={`font-semibold ${themeClasses.text} text-sm mb-1`}>
                      {item.title}
                    </div>
                    {item.description && (() => {
                      const processed = processMarkdown(item.description);
                      return processed.isMarkdown ? (
                        <div
                          className={`text-xs ${themeClasses.textSecondary} line-clamp-2`}
                          dangerouslySetInnerHTML={{ __html: processed.html! }}
                        />
                      ) : (
                        <div className={`text-xs ${themeClasses.textSecondary} line-clamp-2`}>
                          {item.description}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Connector line - theme-aware */}
                {!isLast && (
                  <div className={`h-0.5 w-12 ${themeClasses.border} mt-2 flex-shrink-0`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical timeline
  return (
    <div className="relative">
      {items.map((item, index) => {
        const themeClasses = CANVAS_COMPONENTS.themes[item.theme || 'default'];
        const isLast = index === items.length - 1;

        return (
          <div key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Left side: Timestamp + Dot */}
            <div className="flex flex-col items-end min-w-[80px]">
              {showTimestamps && (
                <div className={`text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                  {formatTimestamp(item.timestamp)}
                </div>
              )}
              <div
                className={`w-4 h-4 rounded-full border-4 ${themeClasses.border} bg-white relative z-10`}
              />
            </div>

            {/* Vertical line connector - theme-aware */}
            {!isLast && (
              <div className={`absolute left-[94px] top-10 bottom-0 w-0.5 ${themeClasses.border}`} />
            )}

            {/* Right side: Content */}
            <div className="flex-1">
              <div
                className={`p-4 ${themeClasses.bg} border-2 ${themeClasses.border} rounded-lg ${
                  interactive ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
                }`}
              >
                {item.icon && <span className="text-2xl mb-2 block">{item.icon}</span>}
                <div className="flex items-baseline gap-2 mb-1">
                  <h4 className={`font-semibold ${themeClasses.text} flex-1 leading-tight`}>{item.title}</h4>
                  {/* Citation indicator - superscript by default */}
                  {item.citations && item.citations.length > 0 && (
                    <CanvasCitation citations={item.citations} />
                  )}
                </div>
                {item.description && (() => {
                  const processed = processMarkdown(item.description);
                  return processed.isMarkdown ? (
                    <p
                      className={`text-sm ${themeClasses.textSecondary} mb-2 leading-relaxed`}
                      dangerouslySetInnerHTML={{ __html: processed.html! }}
                    />
                  ) : (
                    <p className={`text-sm ${themeClasses.textSecondary} mb-2 leading-relaxed`}>
                      {item.description}
                    </p>
                  );
                })()}

                {/* Screenshot thumbnails */}
                {item.screenshotIds && item.screenshotIds.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {item.screenshotIds.slice(0, 3).map((id) => (
                      <div
                        key={id}
                        className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-400"
                      >
                        📷
                      </div>
                    ))}
                    {item.screenshotIds.length > 3 && (
                      <div className="w-16 h-16 bg-gray-50 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                        +{item.screenshotIds.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
