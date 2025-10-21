/**
 * CanvasList - Data Display Component
 *
 * Styled list with bullets, numbers, checkmarks, or custom icons.
 * Enhanced with colored icon backgrounds and theme-aware badges.
 */

import React from 'react';
import { Check, Circle } from 'lucide-react';
import type { ListProps } from '../types';
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

export function CanvasList({ items, variant = 'bulleted', spacing = 'normal', theme = 'default' }: ListProps) {
  // Get theme classes
  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  // Map spacing to gap classes (improved for readability)
  const spacingClasses = {
    tight: 'space-y-1.5',    // Slightly increased from 1
    normal: 'space-y-3',     // Increased from 2
    relaxed: 'space-y-4',    // Increased from 3
    loose: 'space-y-5',      // Increased from 4
  };

  // Theme-aware badge colors
  const badgeColors = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-cyan-100 text-cyan-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  const ListTag = variant === 'numbered' ? 'ol' : 'ul';
  const listTypeClass = variant === 'numbered' ? 'list-decimal list-inside' : '';

  return (
    <ListTag className={`${spacingClasses[spacing]} ${listTypeClass}`}>
      {items.map((item, index) => (
        <li key={item.id} className="flex items-start gap-3">
          {/* Enhanced Icon/Bullet */}
          {variant === 'checkmark' && (
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
              <Check className="w-4 h-4 text-green-700" />
            </div>
          )}
          {variant === 'bulleted' && !variant.includes('numbered') && (
            <div className="flex-shrink-0 mt-2">
              <Circle className={`w-2 h-2 ${themeClasses.textSecondary} fill-current`} />
            </div>
          )}
          {variant === 'custom' && item.icon && (
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mt-0.5 shadow-sm">
              <span className="text-base">{item.icon}</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              {(() => {
                const processed = processMarkdown(item.content);
                return processed.isMarkdown ? (
                  <span
                    className={`${themeClasses.text} ${TYPOGRAPHY.body.default} leading-relaxed`}
                    dangerouslySetInnerHTML={{ __html: processed.html! }}
                  />
                ) : (
                  <span className={`${themeClasses.text} ${TYPOGRAPHY.body.default} leading-relaxed`}>{item.content}</span>
                );
              })()}
              {/* Theme-aware badge */}
              {item.badge && (
                <span className={`px-2.5 py-0.5 ${TYPOGRAPHY.badge} rounded-full ${badgeColors[theme]}`}>
                  {item.badge}
                </span>
              )}
              {/* Citation indicator - superscript by default */}
              {item.citations && item.citations.length > 0 && (
                <CanvasCitation citations={item.citations} />
              )}
            </div>

            {/* Metadata */}
            {item.metadata && (
              <div className={`${TYPOGRAPHY.caption} ${themeClasses.textSecondary} mt-1 flex items-center gap-1`}>
                <span className="opacity-50">→</span>
                <span>{item.metadata}</span>
              </div>
            )}

            {/* Sub-items */}
            {item.subItems && item.subItems.length > 0 && (
              <ul className="mt-2 ml-4 space-y-1.5">
                {item.subItems.map((subItem, subIndex) => {
                  const processed = processMarkdown(subItem);
                  return (
                    <li key={subIndex} className="flex items-start gap-2">
                      <Circle className={`flex-shrink-0 w-1.5 h-1.5 ${themeClasses.textSecondary} fill-current mt-1.5`} />
                      {processed.isMarkdown ? (
                        <span
                          className={`${TYPOGRAPHY.body.default} ${themeClasses.textSecondary} leading-relaxed`}
                          dangerouslySetInnerHTML={{ __html: processed.html! }}
                        />
                      ) : (
                        <span className={`${TYPOGRAPHY.body.default} ${themeClasses.textSecondary} leading-relaxed`}>{subItem}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ListTag>
  );
}
