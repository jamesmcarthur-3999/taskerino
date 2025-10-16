import React, { useMemo } from 'react';
import type { Session } from '../types';
import { groupActivitiesIntoBlocks, formatDuration, calculateActivityStats } from '../utils/activityUtils';

interface SessionActivityTimelineProps {
  session: Session;
  onBlockClick?: (screenshotIds: string[]) => void;
  compact?: boolean;
}

export function SessionActivityTimeline({
  session,
  onBlockClick,
  compact = false
}: SessionActivityTimelineProps) {
  const activityBlocks = useMemo(
    () => groupActivitiesIntoBlocks(session.screenshots, session),
    [session.screenshots, session]
  );

  const activityStats = useMemo(
    () => calculateActivityStats(activityBlocks),
    [activityBlocks]
  );

  const totalDuration = useMemo(() => {
    if (!session.startTime) return 0;
    const endTime = session.endTime ? new Date(session.endTime) : new Date();
    return Math.floor((endTime.getTime() - new Date(session.startTime).getTime()) / 60000);
  }, [session.startTime, session.endTime]);

  if (activityBlocks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No activity data available yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Timeline Header */}
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">Activity Timeline</h4>
          <span className="text-xs text-gray-500">
            {formatDuration(totalDuration)} total
          </span>
        </div>
      )}

      {/* Visual Timeline */}
      <div className="relative">
        {/* Timeline Track */}
        <div className="flex gap-0.5 h-20 bg-gradient-to-br from-gray-100/80 via-white to-gray-100/80 rounded-2xl overflow-hidden p-2 shadow-inner border-2 border-white/60 backdrop-blur-sm">
          {activityBlocks.map((block) => {
            const widthPercent = totalDuration > 0
              ? (block.duration / totalDuration) * 100
              : 0;

            const blockStyle = {
              width: `${widthPercent}%`,
              background: `linear-gradient(145deg, ${block.color}ee 0%, ${block.color} 50%, ${block.color}dd 100%)`,
              minWidth: widthPercent < 2 ? '10px' : undefined,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)',
            };

            const blockClassName = onBlockClick
              ? "group relative transition-all duration-300 hover:brightness-110 hover:scale-[1.05] hover:shadow-xl hover:z-10 active:scale-95 cursor-pointer rounded-xl"
              : "group relative rounded-xl";

            const BlockElement = onBlockClick ? 'button' : 'div';

            return (
              <BlockElement
                key={block.id}
                onClick={onBlockClick ? () => onBlockClick(block.screenshotIds) : undefined}
                className={blockClassName}
                style={blockStyle}
                title={`${block.activity} - ${formatDuration(block.duration)}`}
                {...(onBlockClick && { type: 'button' as const })}
              >
                {/* Activity Label (only if wide enough) */}
                {widthPercent > 10 && !compact && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                    <span className="text-[11px] font-bold text-white drop-shadow-md truncate opacity-80 group-hover:opacity-100 transition-opacity">
                      {block.activity}
                    </span>
                    <span className="text-[9px] text-white/90 font-semibold mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatDuration(block.duration)}
                    </span>
                  </div>
                )}

                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-20">
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white text-xs rounded-xl px-4 py-3 whitespace-nowrap shadow-2xl border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-md"
                        style={{ backgroundColor: block.color }}
                      />
                      <span className="font-bold text-sm">{block.activity}</span>
                    </div>
                    <div className="text-gray-300 font-semibold mb-1">
                      {formatDuration(block.duration)} • {((block.duration / totalDuration) * 100).toFixed(1)}%
                    </div>
                    <div className="text-gray-400 text-[10px] flex items-center gap-1">
                      <span>{new Date(block.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}</span>
                      <span>→</span>
                      <span>{new Date(block.endTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-900" />
                  </div>
                </div>
              </BlockElement>
            );
          })}
        </div>

        {/* Time Markers (for detailed view) */}
        {!compact && totalDuration > 60 && (
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-gray-400">
              {new Date(session.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </span>
            {session.endTime && (
              <span className="text-[10px] text-gray-400">
                {new Date(session.endTime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Activity Breakdown (for detailed view) */}
      {!compact && (
        <div className="mt-4 space-y-2">
          <h5 className="text-xs font-semibold text-gray-600 mb-3">Activity Breakdown</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activityStats.activities.map((activity) => (
              <div
                key={activity.name}
                className="flex items-center justify-between px-4 py-2.5 bg-white/60 backdrop-blur-sm rounded-xl border border-white/80 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-5 h-5 rounded-lg shadow-sm flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${activity.color} 0%, ${activity.color}dd 100%)` }}
                  />
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {activity.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-xs text-gray-500 font-medium">
                    {formatDuration(activity.duration)}
                  </span>
                  <div className="w-12 text-right">
                    <span className="text-xs font-semibold text-gray-700">
                      {activity.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
