import { useRef } from 'react';
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
}

export function VirtualizedSessionList({
  sessions,
  bulkSelectMode,
  selectedSessionIds,
  selectedSessionId,
  onSessionClick,
  onSessionSelect,
  isSessionNewlyCompleted,
}: VirtualizedSessionListProps) {
  // Create a scrollable container ref for this virtualized list
  const parentRef = useRef<HTMLDivElement>(null);

  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated height of each session card in pixels
    overscan: 5, // Number of items to render outside of the visible area
    gap: 12, // Gap between items (matches space-y-3 which is 0.75rem = 12px)
  });

  return (
    <div
      ref={parentRef}
      style={{
        height: '600px', // Fixed height for virtualized container
        overflow: 'auto',
      }}
      className="rounded-[16px]"
    >
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
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: '12px', // Space between items
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
    </div>
  );
}
