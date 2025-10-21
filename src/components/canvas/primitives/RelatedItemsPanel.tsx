/**
 * RelatedItemsPanel - Shows Existing Tasks/Notes with Suggested Updates
 *
 * Displays items already in the system that relate to this session.
 * Can suggest updates to these items based on session content.
 */

import React, { useState } from 'react';
import {
  ExternalLink,
  CheckCircle,
  FileText,
  Circle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RelatedItemsPanelProps, RelatedItem } from '../types';
import { getGlassClasses, getRadiusClass, CANVAS_COMPONENTS, TRANSITIONS } from '../../../design-system/theme';

export function RelatedItemsPanel({
  items,
  title = 'Related Items',
  showItemsWithoutUpdates = true,
  maxItems = 10,
  theme = 'default',
}: RelatedItemsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [executingItemId, setExecutingItemId] = useState<string | null>(null);

  const themeClasses = CANVAS_COMPONENTS.themes[theme];

  // Filter items based on showItemsWithoutUpdates
  const filteredItems = showItemsWithoutUpdates
    ? items
    : items.filter((item) => item.suggestedUpdate);

  // Apply maxItems limit
  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, maxItems);
  const hasMore = filteredItems.length > maxItems;

  // Group items by type
  const taskItems = visibleItems.filter((item) => item.type === 'task');
  const noteItems = visibleItems.filter((item) => item.type === 'note');

  // Handle update action execution
  const handleExecuteUpdate = async (item: RelatedItem) => {
    if (!item.suggestedUpdate) return;

    setExecutingItemId(item.id);
    try {
      // Execution will be handled by ComponentRenderer context
      console.log('[RelatedItemsPanel] Execute update for:', item.id, item.suggestedUpdate);

      // Simulate execution delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('[RelatedItemsPanel] Update execution failed:', error);
    } finally {
      setExecutingItemId(null);
    }
  };

  // Get status icon for tasks
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Loader2 className="w-4 h-4 text-blue-600" />;
      case 'blocked':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'todo':
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get priority badge classes
  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;

    const badgeClasses = {
      urgent: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-gray-100 text-gray-600 border-gray-300',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${getRadiusClass('element')} ${
          badgeClasses[priority as keyof typeof badgeClasses] || badgeClasses.low
        }`}
      >
        {priority}
      </span>
    );
  };

  // Get status badge
  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const badgeClasses = {
      done: 'bg-green-100 text-green-700 border-green-300',
      'in-progress': 'bg-blue-100 text-blue-700 border-blue-300',
      blocked: 'bg-red-100 text-red-700 border-red-300',
      todo: 'bg-gray-100 text-gray-600 border-gray-300',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${getRadiusClass('element')} ${
          badgeClasses[status as keyof typeof badgeClasses] || badgeClasses.todo
        }`}
      >
        {status}
      </span>
    );
  };

  // Render individual item
  const renderItem = (item: RelatedItem) => {
    const isTask = item.type === 'task';
    const hasUpdate = !!item.suggestedUpdate;
    const isExecuting = executingItemId === item.id;

    return (
      <div
        key={item.id}
        className={`
          ${getGlassClasses('subtle')}
          ${getRadiusClass('card')}
          border-2
          ${hasUpdate ? 'border-blue-300 bg-blue-50/30' : 'border-white/60'}
          p-4
          ${TRANSITIONS.standard}
          hover:shadow-md
        `}
      >
        {/* Header: Icon, Title, Status/Priority */}
        <div className="flex items-start gap-3 mb-3">
          {/* Icon */}
          <div className={`flex-shrink-0 mt-0.5 ${isTask ? 'text-blue-600' : 'text-cyan-600'}`}>
            {isTask ? getStatusIcon(item.status) : <FileText className="w-4 h-4" />}
          </div>

          {/* Title and metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-gray-900 text-sm leading-snug">{item.title}</h4>
              <button
                className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${TRANSITIONS.fast}`}
                title="View item"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-2">
              {isTask && item.status && getStatusBadge(item.status)}
              {isTask && item.priority && getPriorityBadge(item.priority)}
              {item.tags && item.tags.length > 0 && (
                <>
                  {item.tags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 text-xs font-medium ${
                        isTask ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
                      } ${getRadiusClass('element')}`}
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{item.tags.length - 3} more</span>
                  )}
                </>
              )}
            </div>

            {/* Relevance explanation */}
            <div className="text-sm text-gray-700 italic mb-3 leading-relaxed">{item.relevance}</div>

            {/* Suggested update section */}
            {hasUpdate && (
              <div
                className={`
                  p-3
                  bg-gradient-to-r from-blue-50 to-cyan-50
                  border-2 border-blue-200/60
                  ${getRadiusClass('element')}
                  space-y-2
                `}
              >
                <div className="text-xs font-semibold text-blue-700 mb-1">💡 Suggested Update:</div>
                <div className="text-sm text-blue-900">{item.suggestedUpdate!.label}</div>

                {/* Update reasoning */}
                {item.suggestedUpdate!.metadata?.reasoning && (
                  <div className="text-xs text-blue-700 italic">
                    {item.suggestedUpdate!.metadata.reasoning}
                  </div>
                )}

                {/* Update button */}
                <button
                  onClick={() => handleExecuteUpdate(item)}
                  disabled={isExecuting}
                  className={`
                    inline-flex items-center gap-2
                    px-3 py-1.5
                    text-sm font-semibold
                    text-white
                    bg-gradient-to-r from-blue-500 to-blue-600
                    ${getRadiusClass('element')}
                    hover:from-blue-600 hover:to-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${TRANSITIONS.fast}
                    shadow-sm hover:shadow-md
                  `}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Update
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Metadata (dates) */}
            {(item.createdAt || item.lastModified) && (
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
                {item.lastModified && (
                  <span>Modified: {new Date(item.lastModified).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Empty state
  if (filteredItems.length === 0) {
    return (
      <div
        className={`
          ${getGlassClasses('medium')}
          ${getRadiusClass('card')}
          border-2
          ${themeClasses.border}
          p-8
          text-center
        `}
      >
        <div className="text-gray-400 mb-2">
          <FileText className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">
          {showItemsWithoutUpdates
            ? 'No related items found'
            : 'No items with suggested updates'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`
        ${getGlassClasses('medium')}
        ${getRadiusClass('card')}
        border-2
        ${themeClasses.border}
        overflow-hidden
      `}
    >
      {/* Header */}
      <div className={`p-4 border-b-2 ${themeClasses.border} ${themeClasses.bg}`}>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
          {!showItemsWithoutUpdates && ' with suggested updates'}
        </p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Tasks Section */}
        {taskItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Tasks ({taskItems.length})
              </h4>
            </div>
            <div className="space-y-3">{taskItems.map(renderItem)}</div>
          </div>
        )}

        {/* Notes Section */}
        {noteItems.length > 0 && (
          <div className="space-y-3">
            {taskItems.length > 0 && (
              <div className="border-t-2 border-white/50 my-4"></div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-cyan-600" />
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Notes ({noteItems.length})
              </h4>
            </div>
            <div className="space-y-3">{noteItems.map(renderItem)}</div>
          </div>
        )}

        {/* Show More Button */}
        {hasMore && (
          <div className="pt-3 border-t-2 border-white/50">
            <button
              onClick={() => setShowAll(!showAll)}
              className={`
                w-full
                flex items-center justify-center gap-2
                px-4 py-2
                text-sm font-medium
                text-gray-700
                ${getGlassClasses('subtle')}
                border-2 border-white/60
                ${getRadiusClass('element')}
                hover:bg-white/80
                ${TRANSITIONS.fast}
              `}
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show {filteredItems.length - maxItems} More
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
