/**
 * CanvasTabs - Layout Component
 *
 * Tabbed interface for organizing related content.
 * Supports horizontal and vertical orientations with badges and icons.
 *
 * Note: Content for each tab comes from the children array, matched by index.
 */

import React, { useState, type ReactNode } from 'react';
import type { TabsProps } from '../types';
import { getRadiusClass } from '../../../design-system/theme';
import { ComponentRenderer } from '../ComponentRenderer';

export function CanvasTabs({ tabs, defaultTab, orientation = 'horizontal', children }: TabsProps & { children?: ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  // Convert children to array if needed
  const childrenArray = React.Children.toArray(children);

  // Find the active tab's index to get corresponding content
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const activeContent = activeTabIndex >= 0 ? childrenArray[activeTabIndex] : null;

  if (orientation === 'vertical') {
    // Vertical layout: tabs on left, content on right
    return (
      <div className="flex gap-4">
        {/* Sidebar with tabs */}
        <div className="flex-shrink-0 w-48 space-y-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'w-full text-left px-4 py-2.5',
                  getRadiusClass('field'),
                  'flex items-center justify-between gap-3',
                  'transition-all duration-200',
                  isActive
                    ? 'bg-white shadow-md border-2 border-gray-200 text-gray-900 font-semibold'
                    : 'bg-white/40 hover:bg-white/60 border-2 border-transparent text-gray-600 hover:text-gray-900',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-center gap-2">
                  {tab.icon && <span>{tab.icon}</span>}
                  <span className="text-sm">{tab.label}</span>
                </div>
                {tab.badge && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-100 text-cyan-700 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1">
          {activeContent}
        </div>
      </div>
    );
  }

  // Horizontal layout: tabs on top, content below
  return (
    <div className="w-full">
      {/* Tab buttons */}
      <div className="flex gap-2 mb-4 border-b-2 border-gray-200 pb-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2',
                getRadiusClass('element'),
                'flex items-center gap-2',
                'transition-all duration-200',
                isActive
                  ? 'bg-white shadow-lg text-gray-900 font-semibold -mb-2'
                  : 'bg-transparent hover:bg-white/50 text-gray-600 hover:text-gray-900',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span className="text-sm">{tab.label}</span>
              {tab.badge && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-100 text-cyan-700 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="w-full">
        {activeContent}
      </div>
    </div>
  );
}
