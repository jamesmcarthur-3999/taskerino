import { useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Session } from '../../types';
import { SessionCard } from './SessionCard';

// Virtual item types - either a date group header or a session
type VirtualItem =
  | { type: 'header'; label: string }
  | { type: 'session'; session: Session };

interface UnifiedVirtualSessionListProps {
  groupedSessions: {
    today: Session[];
    yesterday: Session[];
    thisWeek: Session[];
    earlier: Session[];
  };
  bulkSelectMode: boolean;
  selectedSessionIds: Set<string>;
  selectedSessionId: string | null;
  onSessionClick: (sessionId: string) => void;
  onSessionSelect: (sessionId: string) => void;
  isSessionNewlyCompleted: (sessionId: string) => boolean;
  scrollElementRef?: React.RefObject<HTMLDivElement>; // Parent scroll container
}

export function UnifiedVirtualSessionList({
  groupedSessions,
  bulkSelectMode,
  selectedSessionIds,
  selectedSessionId,
  onSessionClick,
  onSessionSelect,
  isSessionNewlyCompleted,
  scrollElementRef,
}: UnifiedVirtualSessionListProps) {
  // Flatten grouped sessions into a single array with headers
  const virtualItems = useMemo(() => {
    const items: VirtualItem[] = [];

    // Helper to add a group
    const addGroup = (label: string, sessions: Session[]) => {
      if (sessions.length === 0) return;

      items.push({ type: 'header', label });
      sessions.forEach(session => {
        items.push({ type: 'session', session });
      });
    };

    addGroup('Today', groupedSessions.today);
    addGroup('Yesterday', groupedSessions.yesterday);
    addGroup('This Week', groupedSessions.thisWeek);
    addGroup('Earlier', groupedSessions.earlier);

    return items;
  }, [groupedSessions]);

  // Initialize virtualizer with parent scroll element and dynamic measurement
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => scrollElementRef?.current || null,
    estimateSize: (index) => {
      // Headers are smaller (estimated 32px), sessions are larger (estimated 150px)
      const item = virtualItems[index];
      return item.type === 'header' ? 32 : 150;
    },
    overscan: 5, // Number of items to render outside of the visible area
    gap: 12, // Gap between items (matches space-y-3 which is 0.75rem = 12px)
    measureElement: (element) => {
      // Dynamically measure actual element height
      return element.getBoundingClientRect().height;
    },
  });

  // Fix: Remeasure when scroll element becomes valid after sidebar mode change
  useEffect(() => {
    const scrollElement = scrollElementRef?.current;
    if (scrollElement) {
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
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = virtualItems[virtualRow.index];

        return (
          <div
            key={virtualRow.index}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {item.type === 'header' ? (
              // Render group header
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
                {item.label}
              </h3>
            ) : (
              // Render session card
              <SessionCard
                session={item.session}
                onClick={() => onSessionClick(item.session.id)}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedSessionIds.has(item.session.id)}
                onSelect={(id) => onSessionSelect(id)}
                isNewlyCompleted={isSessionNewlyCompleted(item.session.id)}
                isViewing={item.session.id === selectedSessionId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
