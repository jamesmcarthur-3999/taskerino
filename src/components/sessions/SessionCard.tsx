import React from 'react';
import { Trash2, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Session } from '../../types';
import { useSessionList } from '../../context/SessionListContext';
import { useUI } from '../../context/UIContext';
import { useTasks } from '../../context/TasksContext';
import { InlineTagManager } from '../InlineTagManager';
import { tagUtils } from '../../utils/tagUtils';
import { getSuccessGradient, getInfoGradient, getGlassClasses, getWarningGradient, getDangerGradient } from '../../design-system/theme';
import { useEnrichmentContext } from '../../context/EnrichmentContext';

interface SessionCardProps {
  session: Session;
  onClick: () => void;
  bulkSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (sessionId: string) => void;
  onTagClick?: (tag: string) => void;
  isNewlyCompleted?: boolean;
  isViewing?: boolean;
}

export function SessionCard({
  session,
  onClick,
  bulkSelectMode = false,
  isSelected = false,
  onSelect,
  onTagClick,
  isNewlyCompleted = false,
  isViewing = false,
}: SessionCardProps) {
  const { sessions, updateSession, deleteSession } = useSessionList();
  const { addNotification } = useUI();
  const { dispatch: tasksDispatch } = useTasks();
  const { getActiveEnrichment } = useEnrichmentContext();
  const startDate = new Date(session.startTime);
  const endDate = session.endTime ? new Date(session.endTime) : null;

  // Check if session is being enriched
  const enrichmentStatus = session.enrichmentStatus?.status || 'idle';
  const activeEnrichment = getActiveEnrichment(session.id);
  const isEnriching = enrichmentStatus === 'in-progress' || enrichmentStatus === 'waiting' || !!activeEnrichment;
  const enrichmentFailed = enrichmentStatus === 'failed';

  // Handler to extract all recommended tasks from summary
  const handleExtractAllTasks = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail view

    if (!session.summary?.recommendedTasks || session.summary.recommendedTasks.length === 0) {
      addNotification({
        type: 'info',
        title: 'No Tasks Available',
        message: 'This session has no recommended tasks to extract.',
      });
      return;
    }

    // Create tasks from all recommendations
    const extractedTaskIds: string[] = [];

    session.summary.recommendedTasks.forEach(taskRec => {
      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: taskRec.title,
        done: false,
        priority: taskRec.priority,
        status: 'todo' as const,
        createdBy: 'ai' as const,
        createdAt: new Date().toISOString(),
        sourceSessionId: session.id,
        sourceExcerpt: taskRec.title,
        description: taskRec.context || `Extracted from session: ${session.name}`,
        contextForAgent: taskRec.context
          ? `This task was identified during the session "${session.name}". Context: ${taskRec.context}`
          : `This task was identified during the session "${session.name}".`,
        tags: [],
      };

      tasksDispatch({ type: 'ADD_TASK', payload: newTask });
      extractedTaskIds.push(newTask.id);
    });

    // Update session with all extracted task IDs
    updateSession(session.id, {
      extractedTaskIds: [...session.extractedTaskIds, ...extractedTaskIds]
    });

    addNotification({
      type: 'success',
      title: 'Tasks Extracted',
      message: `${session.summary.recommendedTasks.length} tasks added from session "${session.name}"`,
    });
  };

  // Handler to delete session
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail view

    if (window.confirm(`Delete session "${session.name}"? This action cannot be undone.`)) {
      try {
        await deleteSession(session.id);

        addNotification({
          type: 'success',
          title: 'Session Deleted',
          message: `"${session.name}" has been deleted.`,
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Delete Failed',
          message: error instanceof Error ? error.message : 'Failed to delete session',
        });
      }
    }
  };

  const handleCardClick = () => {
    if (bulkSelectMode && onSelect) {
      onSelect(session.id);
    } else {
      onClick();
    }
  };

  // Get semantic gradients from design system
  const successGradient = getSuccessGradient('light');
  const infoGradient = getInfoGradient('light');
  const warningGradient = getWarningGradient('light');
  const dangerGradient = getDangerGradient('light');

  return (
    <div
      onClick={handleCardClick}
      className={`group relative backdrop-blur-xl rounded-[24px] border-2 p-4 hover:shadow-md transition-all cursor-pointer overflow-hidden ${
        isNewlyCompleted
          ? `${successGradient.container} border-green-400 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500`
          : bulkSelectMode && isSelected
          ? `${infoGradient.container} border-cyan-400 shadow-lg`
          : isViewing
          ? `${getGlassClasses('medium')} border-cyan-400/80 shadow-lg shadow-cyan-200/20 ring-2 ring-cyan-400/30`
          : isEnriching
          ? `${warningGradient.container} border-amber-300/60 shadow-md`
          : enrichmentFailed
          ? `${dangerGradient.container} border-red-300/60`
          : `${getGlassClasses('subtle')} hover:bg-white/60 hover:border-cyan-300/60`
      }`}
    >
      {/* Status badges (top-right) */}
      {isNewlyCompleted && !isEnriching && !enrichmentFailed && (
        <div className={`absolute top-3 right-3 px-2.5 py-1 ${getSuccessGradient('strong').container} text-white rounded-full text-xs font-bold shadow-lg animate-in zoom-in duration-300 flex items-center gap-1`}>
          <Sparkles size={12} />
          <span>NEW</span>
        </div>
      )}

      {/* Enriching badge */}
      {isEnriching && (
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold shadow-lg animate-in zoom-in duration-300 flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" />
          <span>ENRICHING</span>
        </div>
      )}

      {/* Failed badge */}
      {enrichmentFailed && (
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full text-xs font-bold shadow-lg animate-in zoom-in duration-300 flex items-center gap-1">
          <AlertCircle size={12} />
          <span>FAILED</span>
        </div>
      )}
      {/* Checkbox - Shows in bulk select mode */}
      {bulkSelectMode && (
        <div
          className="absolute top-3 left-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(session.id)}
            className="w-5 h-5 rounded border-2 border-gray-300 text-cyan-600 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 cursor-pointer transition-all"
          />
        </div>
      )}

      {/* Delete Button - Appears on hover (hidden in bulk select mode) */}
      {!bulkSelectMode && (
        <button
          onClick={handleDelete}
          className="absolute top-3 right-3 p-1.5 bg-white/80 hover:bg-red-50 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Delete session"
        >
          <Trash2 size={14} className="text-gray-400 hover:text-red-600" />
        </button>
      )}

      {/* Minimal Card Content */}
      <div className={bulkSelectMode ? "pl-8 pr-4" : "pr-8"}>
        {/* Session Name */}
        <h4 className="font-semibold text-gray-900 mb-2 leading-tight">
          {session.name}
        </h4>

        {/* Description - 2 lines max */}
        {session.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
            {session.description}
          </p>
        )}

        {/* Category & Sub-Category */}
        {(session.category || session.subCategory) && (
          <div className="flex items-center gap-2 mb-3">
            {session.category && (
              <span className={`px-2.5 py-1 ${infoGradient.container} text-cyan-800 rounded-full text-xs font-semibold border border-cyan-200`}>
                {session.category}
              </span>
            )}
            {session.subCategory && (
              <span className={`px-2.5 py-1 ${getGlassClasses('medium')} text-gray-700 rounded-full text-xs font-medium border border-gray-200`}>
                {session.subCategory}
              </span>
            )}
          </div>
        )}

        {/* Condensed Stats - Single Row */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span className="text-gray-300">•</span>
          <span>
            {session.totalDuration
              ? session.totalDuration < 60
                ? `${session.totalDuration}m`
                : `${Math.floor(session.totalDuration / 60)}h ${session.totalDuration % 60}m`
              : '0m'}
          </span>
          {(session.screenshots?.length || 0) > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <span>{session.screenshots.length} screenshots</span>
            </>
          )}
          {session.audioSegments && session.audioSegments.length > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <span>{Math.floor(session.audioSegments.reduce((sum, seg) => sum + seg.duration, 0) / 60)}m audio</span>
            </>
          )}
        </div>

        {/* Optional: Small tags if present */}
        {session.tags && session.tags.length > 0 && (
          <div className="mt-2">
            <InlineTagManager
              tags={session.tags}
              onTagsChange={(newTags) => {
                updateSession(session.id, { tags: newTags });
              }}
              allTags={tagUtils.getTopTags(sessions, (s) => s.tags || [], 20)}
              onTagClick={onTagClick ? (tag) => onTagClick(tag) : undefined}
              maxDisplayed={5}
              editable={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
