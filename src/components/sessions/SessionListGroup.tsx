import type { Session } from '../../types';
import { SessionCard } from './SessionCard';
import { VirtualizedSessionList } from './VirtualizedSessionList';

interface SessionListGroupProps {
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

// Threshold for enabling virtualization - only virtualize if group has more than this many items
const VIRTUALIZATION_THRESHOLD = 20;

export function SessionListGroup({
  groupedSessions,
  bulkSelectMode,
  selectedSessionIds,
  selectedSessionId,
  onSessionClick,
  onSessionSelect,
  isSessionNewlyCompleted,
  scrollElementRef,
}: SessionListGroupProps) {
  // Helper function to render a session group with or without virtualization
  const renderSessionGroup = (
    title: string,
    sessions: Session[],
    shouldVirtualize: boolean
  ) => {
    if (sessions.length === 0) return null;

    return (
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
          {title}
        </h3>
        {shouldVirtualize ? (
          <VirtualizedSessionList
            sessions={sessions}
            bulkSelectMode={bulkSelectMode}
            selectedSessionIds={selectedSessionIds}
            selectedSessionId={selectedSessionId}
            onSessionClick={onSessionClick}
            onSessionSelect={onSessionSelect}
            isSessionNewlyCompleted={isSessionNewlyCompleted}
            scrollElementRef={scrollElementRef}
          />
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedSessionIds.has(session.id)}
                onSelect={(id) => onSessionSelect(id)}
                isNewlyCompleted={isSessionNewlyCompleted(session.id)}
                isViewing={session.id === selectedSessionId}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Today */}
      {renderSessionGroup(
        'Today',
        groupedSessions.today,
        groupedSessions.today.length > VIRTUALIZATION_THRESHOLD
      )}

      {/* Yesterday */}
      {renderSessionGroup(
        'Yesterday',
        groupedSessions.yesterday,
        groupedSessions.yesterday.length > VIRTUALIZATION_THRESHOLD
      )}

      {/* This Week */}
      {renderSessionGroup(
        'This Week',
        groupedSessions.thisWeek,
        groupedSessions.thisWeek.length > VIRTUALIZATION_THRESHOLD
      )}

      {/* Earlier */}
      {renderSessionGroup(
        'Earlier',
        groupedSessions.earlier,
        groupedSessions.earlier.length > VIRTUALIZATION_THRESHOLD
      )}
    </>
  );
}
