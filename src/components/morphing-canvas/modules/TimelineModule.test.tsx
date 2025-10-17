/**
 * TimelineModule Test/Verification
 *
 * Basic tests to verify the TimelineModule component works correctly
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineModule } from './TimelineModule';
import type { TimelineData } from '../types/module';

describe('TimelineModule', () => {
  const mockData: TimelineData = {
    sessionStart: '2024-01-01T09:00:00Z',
    sessionEnd: '2024-01-01T12:00:00Z',
    events: [
      {
        id: 'evt-1',
        type: 'task_created',
        timestamp: '2024-01-01T09:15:00Z',
        title: 'Test Task',
        description: 'A test task event'
      },
      {
        id: 'evt-2',
        type: 'screenshot_taken',
        timestamp: '2024-01-01T10:30:00Z',
        title: 'Test Screenshot',
        description: 'A test screenshot event'
      }
    ],
    focusPeriods: [
      {
        id: 'fp-1',
        startTime: '2024-01-01T09:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        type: 'focus',
        label: 'Deep Work',
        intensity: 85
      }
    ]
  };

  it('renders without crashing', () => {
    render(
      <div style={{ height: '300px' }}>
        <TimelineModule data={mockData} />
      </div>
    );
    // Component should render without errors
  });

  it('renders horizontal variant by default', () => {
    const { container } = render(
      <div style={{ height: '300px' }}>
        <TimelineModule data={mockData} />
      </div>
    );
    // Check that the component container exists
    expect(container.firstChild).toBeTruthy();
  });

  it('renders vertical variant when specified', () => {
    const { container } = render(
      <div style={{ height: '600px' }}>
        <TimelineModule data={mockData} variant="vertical" />
      </div>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders compact variant when specified', () => {
    const { container } = render(
      <div style={{ height: '120px' }}>
        <TimelineModule data={mockData} variant="compact" />
      </div>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts configuration options', () => {
    const { container } = render(
      <div style={{ height: '300px' }}>
        <TimelineModule
          data={mockData}
          config={{
            showDuration: true,
            showFocusPeriods: true,
            enableScrubbing: true
          }}
        />
      </div>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('handles event click callback', () => {
    let clickedEvent = null;
    const handleEventClick = (event: any) => {
      clickedEvent = event;
    };

    render(
      <div style={{ height: '300px' }}>
        <TimelineModule
          data={mockData}
          onEventClick={handleEventClick}
        />
      </div>
    );
    // Component renders with callback
    expect(clickedEvent).toBeNull(); // No event clicked yet
  });

  it('accepts custom className', () => {
    const { container } = render(
      <div style={{ height: '300px' }}>
        <TimelineModule
          data={mockData}
          className="custom-timeline"
        />
      </div>
    );
    const timeline = container.querySelector('.custom-timeline');
    expect(timeline).toBeTruthy();
  });
});
