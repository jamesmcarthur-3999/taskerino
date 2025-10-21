/**
 * CanvasKeyValue - Data Display Component
 *
 * Property list / metadata display with optional copy-to-clipboard.
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import type { KeyValueProps } from '../types';

export function CanvasKeyValue({ items, layout = 'stacked', spacing = 'normal' }: KeyValueProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (text: string, itemKey: string) => {
    navigator.clipboard.writeText(text.toString());
    setCopiedId(itemKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Map spacing to gap classes
  const spacingClasses = {
    tight: 'gap-2',
    normal: 'gap-3',
    relaxed: 'gap-4',
    loose: 'gap-6',
  };

  if (layout === 'horizontal') {
    // Horizontal layout: key-value pairs inline, separated by dividers
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((item, index) => (
          <React.Fragment key={item.key}>
            <div className="flex items-center gap-2">
              {item.icon && <span className="text-gray-400">{item.icon}</span>}
              <span className="text-sm text-gray-600 leading-relaxed">{item.key}:</span>
              <span className="text-sm font-semibold text-gray-900 leading-relaxed">
                {typeof item.value === 'string' || typeof item.value === 'number'
                  ? item.value
                  : item.value}
              </span>
              {item.copyable && typeof item.value === 'string' && (
                <button
                  onClick={() => handleCopy(item.value as string, item.key)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === item.key ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            {index < items.length - 1 && (
              <div className="h-4 w-px bg-gray-200" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Stacked layout: key-value pairs in rows
  return (
    <div className={`flex flex-col ${spacingClasses[spacing]}`}>
      {items.map((item) => (
        <div key={item.key} className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-[140px] leading-relaxed">
            {item.icon && <span className="text-gray-400">{item.icon}</span>}
            <span>{item.key}:</span>
          </div>
          <div className="flex-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-900 break-words leading-relaxed">
              {typeof item.value === 'string' || typeof item.value === 'number'
                ? item.value
                : item.value}
            </span>
            {item.copyable && typeof item.value === 'string' && (
              <button
                onClick={() => handleCopy(item.value as string, item.key)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy to clipboard"
              >
                {copiedId === item.key ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
