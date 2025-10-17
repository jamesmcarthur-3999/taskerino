/**
 * TimelineModule Example/Demo
 *
 * This file demonstrates how to use the TimelineModule component
 * with various configurations and data structures.
 */

import React, { useState } from 'react';
import { TimelineModule } from './TimelineModule';
import type { TimelineData, TimelineEvent } from '../types/module';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

// Sample timeline data for a productive work session
const sampleTimelineData: TimelineData = {
  sessionStart: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
  sessionEnd: new Date().toISOString(),
  events: [
    {
      id: 'evt-1',
      type: 'focus_started',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      title: 'Started Deep Work Session',
      description: 'Beginning focused work on project features'
    },
    {
      id: 'evt-2',
      type: 'task_created',
      timestamp: new Date(Date.now() - 2.8 * 60 * 60 * 1000).toISOString(),
      title: 'Create Timeline Component',
      description: 'Build interactive timeline visualization',
      linkedItemId: 'task-123',
      linkedItemType: 'task'
    },
    {
      id: 'evt-3',
      type: 'screenshot_taken',
      timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      title: 'Design Mockup Captured',
      description: 'Screenshot of final design for reference'
    },
    {
      id: 'evt-4',
      type: 'note_added',
      timestamp: new Date(Date.now() - 2.3 * 60 * 60 * 1000).toISOString(),
      title: 'Implementation Notes',
      description: 'Key decisions about component architecture',
      linkedItemId: 'note-456',
      linkedItemType: 'note'
    },
    {
      id: 'evt-5',
      type: 'decision_made',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      title: 'Chose SVG Over Canvas',
      description: 'Decided to use SVG for better accessibility and precision'
    },
    {
      id: 'evt-6',
      type: 'break_started',
      timestamp: new Date(Date.now() - 1.8 * 60 * 60 * 1000).toISOString(),
      title: 'Coffee Break',
      description: 'Taking a 15-minute break'
    },
    {
      id: 'evt-7',
      type: 'break_ended',
      timestamp: new Date(Date.now() - 1.55 * 60 * 60 * 1000).toISOString(),
      title: 'Back to Work',
      description: 'Resuming development'
    },
    {
      id: 'evt-8',
      type: 'meeting_started',
      timestamp: new Date(Date.now() - 1.3 * 60 * 60 * 1000).toISOString(),
      title: 'Quick Sync Meeting',
      description: 'Team standup and alignment'
    },
    {
      id: 'evt-9',
      type: 'meeting_ended',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      title: 'Meeting Complete',
      description: 'Back to individual work'
    },
    {
      id: 'evt-10',
      type: 'context_switch',
      timestamp: new Date(Date.now() - 0.8 * 60 * 60 * 1000).toISOString(),
      title: 'Switched to Bug Fixes',
      description: 'Addressing critical issues'
    },
    {
      id: 'evt-11',
      type: 'task_completed',
      timestamp: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
      title: 'Timeline Component Complete',
      description: 'Finished implementation and testing',
      linkedItemId: 'task-123',
      linkedItemType: 'task'
    },
    {
      id: 'evt-12',
      type: 'milestone_reached',
      timestamp: new Date(Date.now() - 0.2 * 60 * 60 * 1000).toISOString(),
      title: 'Feature Complete',
      description: 'All planned features implemented'
    }
  ],
  focusPeriods: [
    {
      id: 'fp-1',
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1.8 * 60 * 60 * 1000).toISOString(),
      type: 'focus',
      intensity: 85,
      label: 'Deep Work',
      color: '#ec4899'
    },
    {
      id: 'fp-2',
      startTime: new Date(Date.now() - 1.8 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1.55 * 60 * 60 * 1000).toISOString(),
      type: 'break',
      label: 'Coffee Break',
      color: '#f97316'
    },
    {
      id: 'fp-3',
      startTime: new Date(Date.now() - 1.3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      type: 'meeting',
      label: 'Team Sync',
      color: '#0ea5e9'
    },
    {
      id: 'fp-4',
      startTime: new Date(Date.now() - 0.8 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now()).toISOString(),
      type: 'focus',
      intensity: 70,
      label: 'Bug Fixes',
      color: '#8b5cf6'
    }
  ],
  currentTime: new Date().toISOString() // Current position in timeline
};

// Example component demonstrating all variants
export const TimelineModuleExample: React.FC = () => {
  const [selectedVariant, setSelectedVariant] = useState<'horizontal' | 'vertical' | 'compact'>('horizontal');
  const [showDuration, setShowDuration] = useState(true);
  const [showFocusPeriods, setShowFocusPeriods] = useState(true);
  const [enableScrubbing, setEnableScrubbing] = useState(true);

  const handleEventClick = (event: TimelineEvent) => {
    console.log('Event clicked:', event);
    alert(`Clicked: ${event.title}\nType: ${event.type}\nTime: ${new Date(event.timestamp).toLocaleTimeString()}`);
  };

  const handleTimeSeek = (timestamp: string) => {
    console.log('Seeking to:', timestamp);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Timeline Module Demo
          </h1>
          <p className="text-gray-600 text-lg">
            Interactive session timeline with multiple visualization variants
          </p>
        </div>

        {/* Controls */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-lg`}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Variant Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Variant
              </label>
              <div className="flex gap-2">
                {(['horizontal', 'vertical', 'compact'] as const).map(variant => (
                  <button
                    key={variant}
                    onClick={() => setSelectedVariant(variant)}
                    className={`flex-1 px-4 py-2 ${getRadiusClass('field')} text-sm font-semibold transition-all ${
                      selectedVariant === variant
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                        : 'bg-white/60 text-gray-700 hover:bg-white/80 border border-white/80'
                    }`}
                  >
                    {variant.charAt(0).toUpperCase() + variant.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Options
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDuration}
                  onChange={(e) => setShowDuration(e.target.checked)}
                  className="rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                />
                Show Duration
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFocusPeriods}
                  onChange={(e) => setShowFocusPeriods(e.target.checked)}
                  className="rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                />
                Show Focus Periods
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableScrubbing}
                  onChange={(e) => setEnableScrubbing(e.target.checked)}
                  className="rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                />
                Enable Scrubbing
              </label>
            </div>
          </div>
        </div>

        {/* Timeline Display */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            {selectedVariant.charAt(0).toUpperCase() + selectedVariant.slice(1)} Timeline
          </h2>

          <div
            style={{
              height: selectedVariant === 'vertical' ? '600px' : selectedVariant === 'compact' ? '120px' : '300px'
            }}
          >
            <TimelineModule
              data={sampleTimelineData}
              variant={selectedVariant}
              config={undefined}
              onEventClick={handleEventClick}
              onTimeSeek={handleTimeSeek}
            />
          </div>
        </div>

        {/* Event Legend */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-lg`}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Event Types</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sampleTimelineData.events.map(event => {
              const eventType = event.type;
              // Get unique event types
              return null;
            })}
            {Array.from(new Set(sampleTimelineData.events.map(e => e.type))).map(type => {
              const event = sampleTimelineData.events.find(e => e.type === type);
              if (!event) return null;

              return (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color || '#3b82f6' }}
                  />
                  <span className="text-xs text-gray-700 truncate">
                    {type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Usage Info */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-6 shadow-lg`}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Usage</h2>
          <pre className={`bg-gray-900 text-gray-100 p-4 ${getRadiusClass('element')} overflow-x-auto text-xs`}>
{`import { TimelineModule } from './TimelineModule';

<TimelineModule
  data={{
    sessionStart: '2024-01-01T09:00:00Z',
    sessionEnd: '2024-01-01T12:00:00Z',
    events: [...],
    focusPeriods: [...]
  }}
  variant="horizontal"
  config={{
    showDuration: true,
    showFocusPeriods: true,
    enableScrubbing: true
  }}
  onEventClick={(event) => console.log(event)}
  onTimeSeek={(timestamp) => console.log(timestamp)}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default TimelineModuleExample;
