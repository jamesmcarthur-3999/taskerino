/**
 * CanvasAccordion - Layout Component
 *
 * Collapsible sections for progressive disclosure of content.
 * Supports multiple sections open at once or single-section mode.
 *
 * Note: Content for each accordion item comes from the children array, matched by index.
 */

import React, { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { AccordionProps } from '../types';
import { getRadiusClass, getGlassClasses } from '../../../design-system/theme';
import { ComponentRenderer } from '../ComponentRenderer';
import { CanvasCitation } from './CanvasCitation';

export function CanvasAccordion({ items, allowMultiple = false, children }: AccordionProps & { children?: ReactNode }) {
  // Convert children to array if needed
  const childrenArray = React.Children.toArray(children);

  // Track which sections are expanded
  const [expandedIds, setExpandedIds] = useState<string[]>(() => {
    // Initialize with default expanded items
    return items.filter((item) => item.defaultExpanded).map((item) => item.id);
  });

  // Toggle a section's expanded state
  const toggleSection = (id: string) => {
    if (allowMultiple) {
      // Multiple sections can be open
      setExpandedIds((prev) =>
        prev.includes(id) ? prev.filter((expandedId) => expandedId !== id) : [...prev, id]
      );
    } else {
      // Only one section open at a time
      setExpandedIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isExpanded = expandedIds.includes(item.id);
        const itemContent = childrenArray[index];

        return (
          <div
            key={item.id}
            className={[
              getGlassClasses('medium'),
              getRadiusClass('card'),
              'border-2 border-gray-200',
              'overflow-hidden',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Header - Always Visible */}
            <button
              onClick={() => toggleSection(item.id)}
              className={[
                'w-full px-4 py-3.5',  // Slightly increased padding
                'flex items-center justify-between gap-3',
                'bg-white/30 hover:bg-white/60',  // Stronger hover
                'transition-colors duration-200',
                'text-left',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex items-center gap-2 flex-1">
                {item.icon && <span className="text-lg">{item.icon}</span>}
                <span className="text-[15px] font-semibold text-gray-900 leading-snug">{item.title}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-100 text-cyan-700 rounded-full">
                    {item.badge}
                  </span>
                )}
                {/* Citation indicator - superscript by default */}
                {item.citations && item.citations.length > 0 && (
                  <CanvasCitation citations={item.citations} />
                )}
              </div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-600" />
              </motion.div>
            </button>

            {/* Content - Collapsible */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="p-4 border-t-2 border-gray-200 leading-normal">
                    {itemContent}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
