import type { Session } from '../../types';

interface SessionCardProps {
  session: Session;
  onClick: () => void;
  bulkSelectMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isNewlyCompleted: boolean;
}

// SessionCard is currently defined inside SessionsZone.tsx
// This import will need to be updated once SessionCard is extracted
declare function SessionCard(props: SessionCardProps): JSX.Element;

interface SessionListGroupProps {
  groupedSessions: {
    today: Session[];
    yesterday: Session[];
    thisWeek: Session[];
    earlier: Session[];
  };
  bulkSelectMode: boolean;
  selectedSessionIds: Set<string>;
  onSessionClick: (sessionId: string) => void;
  onSessionSelect: (sessionId: string) => void;
  isSessionNewlyCompleted: (sessionId: string) => boolean;
}

export function SessionListGroup({
  groupedSessions,
  bulkSelectMode,
  selectedSessionIds,
  onSessionClick,
  onSessionSelect,
  isSessionNewlyCompleted,
}: SessionListGroupProps) {
  return (
    <>
      {/* Today */}
      {groupedSessions.today.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
            Today
          </h3>
          <div className="space-y-3">
            {groupedSessions.today.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedSessionIds.has(session.id)}
                onSelect={(id) => onSessionSelect(id)}
                isNewlyCompleted={isSessionNewlyCompleted(session.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Yesterday */}
      {groupedSessions.yesterday.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
            Yesterday
          </h3>
          <div className="space-y-3">
            {groupedSessions.yesterday.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedSessionIds.has(session.id)}
                onSelect={(id) => onSessionSelect(id)}
                isNewlyCompleted={isSessionNewlyCompleted(session.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* This Week */}
      {groupedSessions.thisWeek.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
            This Week
          </h3>
          <div className="space-y-3">
            {groupedSessions.thisWeek.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedSessionIds.has(session.id)}
                onSelect={(id) => onSessionSelect(id)}
                isNewlyCompleted={isSessionNewlyCompleted(session.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Earlier */}
      {groupedSessions.earlier.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
            Earlier
          </h3>
          <div className="space-y-3">
            {groupedSessions.earlier.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                bulkSelectMode={bulkSelectMode}
                isSelected={selectedSessionIds.has(session.id)}
                onSelect={(id) => onSessionSelect(id)}
                isNewlyCompleted={isSessionNewlyCompleted(session.id)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
