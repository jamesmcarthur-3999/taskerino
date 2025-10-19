import React from 'react';
import { Activity, Clock, Search, Tag } from 'lucide-react';
import type { Session } from '../../types';
import { CollapsibleSidebar } from '../CollapsibleSidebar';
import { ActiveFiltersDisplay } from './ActiveFiltersDisplay';
import { BulkOperationsBar } from './BulkOperationsBar';
import { SessionsSearchBar } from './SessionsSearchBar';
import { SessionListGroup } from './SessionListGroup';
import { getGlassClasses, getRadiusClass, getDangerGradient, getInfoGradient } from '../../design-system/theme';

interface SessionsListPanelProps {
  // Sessions data
  sessions: Session[];
  allPastSessions: Session[];
  groupedSessions: {
    today: Session[];
    yesterday: Session[];
    thisWeek: Session[];
    earlier: Session[];
  };
  filteredSessions: Session[];
  activeSession: Session | null;

  // Search & filter state
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedFilter: string;
  onSelectedFilterChange: (filter: string) => void;
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedTags: string[];
  onRemoveCategory: (category: string) => void;
  onRemoveSubCategory: (subCategory: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearAllFilters: () => void;

  // Bulk operations state
  bulkSelectMode: boolean;
  selectedSessionIds: Set<string>;
  onSelectAll: () => void;
  onDelete: () => void;
  onCategorize: () => void;
  onTag: () => void;
  onExport: () => void;

  // Session interaction
  selectedSessionId: string | null;
  onSessionClick: (sessionId: string) => void;
  onSessionSelect: (sessionId: string) => void;
  isSessionNewlyCompleted: (sessionId: string) => boolean;

  // Sidebar state
  isSidebarExpanded: boolean;
  onSidebarToggle: (expanded: boolean) => void;
  sessionListScrollRef: React.RefObject<HTMLDivElement>;

  // Error states
  metadataError: string | null;
  onDismissMetadataError: () => void;
}

export function SessionsListPanel({
  sessions,
  allPastSessions,
  groupedSessions,
  filteredSessions,
  activeSession,
  searchQuery,
  onSearchQueryChange,
  selectedFilter,
  onSelectedFilterChange,
  selectedCategories,
  selectedSubCategories,
  selectedTags,
  onRemoveCategory,
  onRemoveSubCategory,
  onRemoveTag,
  onClearAllFilters,
  bulkSelectMode,
  selectedSessionIds,
  onSelectAll,
  onDelete,
  onCategorize,
  onTag,
  onExport,
  selectedSessionId,
  onSessionClick,
  onSessionSelect,
  isSessionNewlyCompleted,
  isSidebarExpanded,
  onSidebarToggle,
  sessionListScrollRef,
  metadataError,
  onDismissMetadataError,
}: SessionsListPanelProps) {
  // Get semantic gradients from design system
  const dangerGradient = getDangerGradient('light');
  const infoGradient = getInfoGradient('light');

  return (
    <CollapsibleSidebar
      width="420px"
      peekWidth="20px"
      collapseBreakpoint={1280}
      side="left"
      isExpanded={isSidebarExpanded}
      onExpandedChange={onSidebarToggle}
    >
      <div className={`h-full ${getGlassClasses('strong')} ${getRadiusClass('card')} border-2 border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden`}>
        {/* Scrollable Content */}
        <div ref={sessionListScrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          {/* Metadata Error Notification */}
          {metadataError && (
            <div className={`mb-4 p-4 ${dangerGradient.container} ${getRadiusClass('field')} flex items-start gap-3`}>
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-red-900 mb-1">AI Narrator Update Failed</h4>
                <p className="text-sm text-red-800">
                  Couldn't update session title/description: {metadataError}
                </p>
              </div>
              <button
                onClick={onDismissMetadataError}
                className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Filters Display */}
          <ActiveFiltersDisplay
            selectedCategories={selectedCategories}
            selectedSubCategories={selectedSubCategories}
            selectedTags={selectedTags}
            onRemoveCategory={onRemoveCategory}
            onRemoveSubCategory={onRemoveSubCategory}
            onRemoveTag={onRemoveTag}
            onClearAll={onClearAllFilters}
          />

          {/* Bulk Operations Bar */}
          {bulkSelectMode && selectedSessionIds.size > 0 && (
            <BulkOperationsBar
              selectedCount={selectedSessionIds.size}
              totalFilteredCount={filteredSessions.length}
              onSelectAll={onSelectAll}
              onDelete={onDelete}
              onCategorize={onCategorize}
              onTag={onTag}
              onExport={onExport}
            />
          )}

          {/* Past Sessions - Grouped Timeline */}
          {allPastSessions.length > 0 ? (
            <div>
              {/* Search Bar */}
              <div className="mb-4 space-y-3">
                {/* Search Bar */}
                <SessionsSearchBar
                  value={searchQuery}
                  onChange={onSearchQueryChange}
                />

                {/* Active Search Indicator */}
                {(searchQuery.trim() || selectedFilter !== 'all') && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Active Filters:</span>
                    {searchQuery.trim() && (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 ${infoGradient.container} text-cyan-700 rounded-full text-xs font-semibold`}>
                        <Search size={12} />
                        <span>"{searchQuery}"</span>
                        <button
                          onClick={() => onSearchQueryChange('')}
                          className="ml-1 hover:text-cyan-900 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {selectedFilter !== 'all' && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 border border-purple-300 rounded-full text-xs font-semibold text-purple-700">
                        <Tag size={12} />
                        <span>{selectedFilter}</span>
                        <button
                          onClick={() => onSelectedFilterChange('all')}
                          className="ml-1 hover:text-purple-900 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        onSearchQueryChange('');
                        onSelectedFilterChange('all');
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 font-semibold underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Session Groups */}
              {filteredSessions.length === 0 && !activeSession ? (
                <div className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} border-2 border-white/50 p-12 text-center`}>
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No sessions found</h3>
                  <p className="text-gray-600">Try adjusting your filters or search query</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Live Session - Always at Top */}
                  {activeSession && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${activeSession.status === 'paused' ? 'bg-yellow-400' : 'bg-green-500 animate-pulse'}`} />
                        Live Session
                      </h3>
                      <div
                        onClick={() => onSessionClick(activeSession.id)}
                        className="group relative backdrop-blur-xl rounded-[24px] border-2 p-4 transition-all overflow-hidden bg-white/40 border-white/60 hover:bg-white/50 hover:border-white/80 cursor-pointer"
                      >
                        {/* Minimal Card Content */}
                        <div>
                          {/* Session Name with Live Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 leading-tight flex-1">
                              {activeSession.name}
                            </h4>
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wide animate-pulse">
                              LIVE
                            </span>
                          </div>

                          {/* Description - 2 lines max */}
                          {activeSession.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                              {activeSession.description}
                            </p>
                          )}

                          {/* Condensed Stats - Single Row */}
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {activeSession.status === 'paused' ? 'Paused' : 'Recording'}
                            </span>
                            {(activeSession.screenshots?.length || 0) > 0 && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span>{activeSession.screenshots.length} screenshots</span>
                              </>
                            )}
                            {activeSession.audioSegments && activeSession.audioSegments.length > 0 && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span>{activeSession.audioSegments.length} audio</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grouped Sessions */}
                  <SessionListGroup
                    groupedSessions={groupedSessions}
                    bulkSelectMode={bulkSelectMode}
                    selectedSessionIds={selectedSessionIds}
                    selectedSessionId={selectedSessionId}
                    onSessionClick={onSessionClick}
                    onSessionSelect={onSessionSelect}
                    isSessionNewlyCompleted={isSessionNewlyCompleted}
                    scrollElementRef={sessionListScrollRef}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="bg-white/40 backdrop-blur-xl rounded-[24px] p-8 border-2 border-white/50">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">No Past Sessions</h3>
                <p className="text-xs text-gray-600">
                  Start tracking a session to see your work history
                </p>
              </div>
            </div>
          )}
        </div>
        {/* End of Scrollable Content */}
      </div>
    </CollapsibleSidebar>
  );
}
