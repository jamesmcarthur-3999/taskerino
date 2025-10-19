import { useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Session } from '../../types';
import { SessionCard } from './SessionCard';

interface VirtualizedSessionListProps {
  sessions: Session[];
  bulkSelectMode: boolean;
  selectedSessionIds: Set<string>;
  selectedSessionId: string | null;
  onSessionClick: (sessionId: string) => void;
  onSessionSelect: (sessionId: string) => void;
  isSessionNewlyCompleted: (sessionId: string) => boolean;
  scrollElementRef?: React.RefObject<HTMLDivElement>; // Parent scroll container
}

export function VirtualizedSessionList({
  sessions,
  bulkSelectMode,
  selectedSessionIds,
  selectedSessionId,
  onSessionClick,
  onSessionSelect,
  isSessionNewlyCompleted,
  scrollElementRef,
}: VirtualizedSessionListProps) {
  // Initialize virtualizer with parent scroll element and dynamic measurement
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => scrollElementRef?.current || null,
    estimateSize: () => 150, // Initial estimate - will be measured dynamically
    overscan: 5, // Number of items to render outside of the visible area
    gap: 12, // Gap between items (matches space-y-3 which is 0.75rem = 12px)
    measureElement: (element) => {
      // Dynamically measure actual element height
      return element.getBoundingClientRect().height;
    },
  });

  // Fix: Remeasure when scroll element becomes valid after sidebar mode change
  // When CollapsibleSidebar switches between layout/overlay modes, the scroll container
  // gets unmounted and remounted, breaking the virtualizer's connection. This effect
  // detects when the scroll element becomes valid again and triggers a remeasure.
  useEffect(() => {
    const scrollElement = scrollElementRef?.current;
    if (scrollElement) {
      // Scroll element is now valid - trigger remeasurement to fix rendering
      virtualizer.measure();
    }
  }, [scrollElementRef?.current, virtualizer]);

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const session = sessions[virtualItem.index];
        return (
          <div
            key={session.id}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <SessionCard
              session={session}
              onClick={() => onSessionClick(session.id)}
              bulkSelectMode={bulkSelectMode}
              isSelected={selectedSessionIds.has(session.id)}
              onSelect={(id) => onSessionSelect(id)}
              isNewlyCompleted={isSessionNewlyCompleted(session.id)}
              isViewing={session.id === selectedSessionId}
            />
          </div>
        );
      })}
    </div>
  );
}
