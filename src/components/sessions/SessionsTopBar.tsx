import React, { useState } from 'react';
import { Play, Pause, Square, Clock, CheckCircle2, CheckCheck, Camera as CameraIcon, Mic, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session } from '../../types';
import type { LastSessionSettings } from '../../utils/lastSessionSettings';
import { ToggleButton } from './ToggleButton';
import { DropdownTrigger } from '../DropdownTrigger';
import { SessionsFilterMenu } from './SessionsFilterMenu';
import { SessionsSortMenu } from './SessionsSortMenu';
import { getWarningGradient, getSuccessGradient, getDangerGradient, getGradientClasses, getRadiusClass } from '../../design-system/theme';
import { useTheme } from '../../context/ThemeContext';

interface SessionsTopBarProps {
  // Session state
  activeSession: Session | undefined;
  sessions: Session[];
  allPastSessions: Session[];

  // Session controls
  isStarting: boolean;
  isEnding: boolean;
  countdown: number | null;
  handleQuickStart: () => void;
  handleEndSession: (sessionId: string) => void;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;

  // Settings
  currentSettings: LastSessionSettings;
  updateScreenshots: (enabled: boolean) => void;
  updateAudio: (enabled: boolean) => void;
  updateVideo: (enabled: boolean) => void;
  updateInterval: (interval: number) => void;

  // Filter/Sort/Select state
  sortBy: 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc';
  onSortChange: (sortBy: 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc') => void;
  selectedCategories: string[];
  selectedSubCategories: string[];
  selectedTags: string[];
  onCategoriesChange: (categories: string[]) => void;
  onSubCategoriesChange: (subCategories: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  bulkSelectMode: boolean;
  selectedSessionIds: Set<string>;
  onBulkSelectModeChange: (enabled: boolean) => void;
  onSelectedSessionIdsChange: (ids: Set<string>) => void;

  // Responsive compact mode
  compactMode?: boolean;
}

export function SessionsTopBar({
  activeSession,
  sessions,
  allPastSessions,
  isStarting,
  isEnding,
  countdown,
  handleQuickStart,
  handleEndSession,
  pauseSession,
  resumeSession,
  currentSettings,
  updateScreenshots,
  updateAudio,
  updateVideo,
  updateInterval,
  sortBy,
  onSortChange,
  selectedCategories,
  selectedSubCategories,
  selectedTags,
  onCategoriesChange,
  onSubCategoriesChange,
  onTagsChange,
  bulkSelectMode,
  selectedSessionIds,
  onBulkSelectModeChange,
  onSelectedSessionIdsChange,
  compactMode = false,
}: SessionsTopBarProps) {
  // Local state for interval dropdown
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);

  // Get semantic gradients from design system
  const warningGradient = getWarningGradient('light');
  const successGradient = getSuccessGradient('strong');
  const dangerGradient = getDangerGradient('strong');
  const resumeGradient = getSuccessGradient('strong');
  const pauseGradient = getWarningGradient('strong');
  const { colorScheme } = useTheme();

  // Helper function to render session controls
  const renderSessionControls = () => (
    <>
      {activeSession ? (
        <>
          {/* Active Session Indicator - Dot always visible, name hides in compact mode */}
          <motion.div
            layout
            className="flex items-center px-3 py-2"
            style={{
              maxWidth: compactMode ? '48px' : '220px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
          >
            <motion.div
              layout="position"
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                activeSession.status === 'paused'
                  ? `${warningGradient.iconBg} shadow-lg shadow-yellow-400/50`
                  : `${successGradient.iconBg} animate-pulse shadow-lg shadow-green-500/50`
              }`}
            />
            <AnimatePresence mode="wait" initial={false}>
              {!compactMode && (
                <motion.span
                  key="session-name"
                  className="text-sm font-bold text-gray-900 truncate"
                  title={activeSession.name}
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{
                    opacity: 1,
                    width: 'auto',
                    marginLeft: '8px',
                    transition: {
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0,
                    transition: {
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                    }
                  }}
                >
                  {activeSession.name}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="h-8 w-px bg-white/30"></div>

          {/* Pause/Resume Button */}
          {activeSession.status === 'paused' ? (
            <motion.button
              layout
              onClick={() => resumeSession(activeSession.id)}
              className={`flex items-center ${getRadiusClass('pill')} ${resumeGradient.container} text-white shadow-md font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border-2 border-transparent`}
              style={{
                paddingLeft: '16px',
                paddingRight: '16px',
                paddingTop: '8px',
                paddingBottom: '8px',
              }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }
              }}
            >
              <motion.div layout="position">
                <Play size={16} />
              </motion.div>
              <AnimatePresence mode="wait" initial={false}>
                {!compactMode && (
                  <motion.span
                    key="resume-label"
                    initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                    animate={{
                      opacity: 1,
                      width: 'auto',
                      marginLeft: '8px',
                      transition: {
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }
                    }}
                    exit={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
                      transition: {
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }
                    }}
                  >
                    Resume
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ) : (
            <motion.button
              layout
              onClick={() => pauseSession(activeSession.id)}
              className={`flex items-center ${getRadiusClass('pill')} ${pauseGradient.container} text-white shadow-md font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border-2 border-transparent`}
              style={{
                paddingLeft: '16px',
                paddingRight: '16px',
                paddingTop: '8px',
                paddingBottom: '8px',
              }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }
              }}
            >
              <motion.div layout="position">
                <Pause size={16} />
              </motion.div>
              <AnimatePresence mode="wait" initial={false}>
                {!compactMode && (
                  <motion.span
                    key="pause-label"
                    initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                    animate={{
                      opacity: 1,
                      width: 'auto',
                      marginLeft: '8px',
                      transition: {
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }
                    }}
                    exit={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
                      transition: {
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }
                    }}
                  >
                    Pause
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {/* Stop Button - with delightful UX */}
          <motion.button
            layout
            onClick={() => handleEndSession(activeSession.id)}
            disabled={isEnding}
            className={`flex items-center ${getRadiusClass('pill')} ${dangerGradient.container} text-white shadow-md font-semibold text-sm transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border-2 border-transparent disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100`}
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
          >
            {isEnding ? (
              <>
                <motion.div layout="position">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </motion.div>
                <motion.span
                  layout="position"
                  style={{ marginLeft: '8px' }}
                >
                  Saving...
                </motion.span>
              </>
            ) : (
              <>
                <motion.div layout="position">
                  <Square size={16} />
                </motion.div>
                <AnimatePresence mode="wait" initial={false}>
                  {!compactMode && (
                    <motion.span
                      key="stop-label"
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{
                        opacity: 1,
                        width: 'auto',
                        marginLeft: '8px',
                        transition: {
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }
                      }}
                      exit={{
                        opacity: 0,
                        width: 0,
                        marginLeft: 0,
                        transition: {
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }
                      }}
                    >
                      Stop
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.button>
        </>
      ) : (
        <>
          {/* Start Session Button */}
          <motion.button
            layout
            onClick={handleQuickStart}
            disabled={isStarting}
            className={`flex items-center ${getRadiusClass('pill')} ${getGradientClasses(colorScheme, 'primary')} text-white shadow-md font-semibold text-sm transition-all border-2 border-transparent disabled:cursor-not-allowed ${
              isStarting
                ? 'animate-pulse shadow-lg shadow-cyan-500/50'
                : 'hover:shadow-lg hover:scale-[1.02] active:scale-95'
            }`}
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
          >
            {isStarting ? (
              countdown !== null && countdown > 0 ? (
                <>
                  <motion.div layout="position">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/40">
                      <span className="text-sm font-bold">{countdown}</span>
                    </div>
                  </motion.div>
                  <motion.span
                    layout="position"
                    style={{ marginLeft: '8px' }}
                  >
                    Starting in {countdown}...
                  </motion.span>
                </>
              ) : countdown === 0 ? (
                <>
                  <motion.div layout="position">
                    <CheckCircle2 size={16} className="animate-pulse" />
                  </motion.div>
                  <motion.span
                    layout="position"
                    style={{ marginLeft: '8px' }}
                  >
                    Recording!
                  </motion.span>
                </>
              ) : (
                <>
                  <motion.div layout="position">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </motion.div>
                  <motion.span
                    layout="position"
                    style={{ marginLeft: '8px' }}
                  >
                    Starting...
                  </motion.span>
                </>
              )
            ) : (
              <>
                <motion.div layout="position">
                  <Play size={16} />
                </motion.div>
                <AnimatePresence mode="wait" initial={false}>
                  {!compactMode && (
                    <motion.span
                      key="start-label"
                      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                      animate={{
                        opacity: 1,
                        width: 'auto',
                        marginLeft: '8px',
                        transition: {
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }
                      }}
                      exit={{
                        opacity: 0,
                        width: 0,
                        marginLeft: 0,
                        transition: {
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }
                      }}
                    >
                      Start Session
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.button>
        </>
      )}

      <div className="h-8 w-px bg-white/30"></div>

      {/* Settings Controls - Always visible */}
      <ToggleButton
        icon={CameraIcon}
        label="Screenshots"
        active={currentSettings.enableScreenshots}
        onChange={updateScreenshots}
        size="sm"
        showLabel={!compactMode}
      />

      <ToggleButton
        icon={Mic}
        label="Audio"
        active={currentSettings.audioRecording}
        onChange={updateAudio}
        size="sm"
        showLabel={!compactMode}
      />

      <ToggleButton
        icon={Video}
        label="Video"
        active={currentSettings.videoRecording || false}
        onChange={updateVideo}
        size="sm"
        showLabel={!compactMode}
      />

      {/* Interval Selector - Show when screenshots enabled */}
      {currentSettings.enableScreenshots && (
        <div className="relative">
          <DropdownTrigger
            icon={Clock}
            label={
              currentSettings.screenshotInterval === -1 ? '🧠 Adaptive' :
              currentSettings.screenshotInterval === 10/60 ? 'Every 10s' :
              currentSettings.screenshotInterval === 0.5 ? 'Every 30s' :
              currentSettings.screenshotInterval === 1 ? 'Every 1m' :
              currentSettings.screenshotInterval === 2 ? 'Every 2m' :
              currentSettings.screenshotInterval === 3 ? 'Every 3m' :
              currentSettings.screenshotInterval === 5 ? 'Every 5m' : ''
            }
            active={showIntervalDropdown}
            onClick={() => setShowIntervalDropdown(!showIntervalDropdown)}
            showLabel={!compactMode}
          />

          {/* Interval Dropdown Panel */}
          {showIntervalDropdown && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white backdrop-blur-xl rounded-[20px] border-2 border-cyan-400/80 shadow-2xl z-[9999]">
              <div className="p-3 space-y-1">
                <button
                  onClick={() => { updateInterval(-1); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    currentSettings.screenshotInterval === -1
                      ? 'bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-900 border-2 border-purple-300'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  🧠 Adaptive (AI-driven)
                </button>
                <div className="border-t border-gray-200 my-2"></div>
                <button
                  onClick={() => { updateInterval(10/60); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSettings.screenshotInterval === 10/60
                      ? 'bg-cyan-100 text-cyan-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Every 10 seconds
                </button>
                <button
                  onClick={() => { updateInterval(0.5); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSettings.screenshotInterval === 0.5
                      ? 'bg-cyan-100 text-cyan-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Every 30 seconds
                </button>
                <button
                  onClick={() => { updateInterval(1); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSettings.screenshotInterval === 1
                      ? 'bg-cyan-100 text-cyan-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Every 1 minute
                </button>
                <button
                  onClick={() => { updateInterval(2); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSettings.screenshotInterval === 2
                      ? 'bg-cyan-100 text-cyan-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Every 2 minutes
                </button>
                <button
                  onClick={() => { updateInterval(3); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSettings.screenshotInterval === 3
                      ? 'bg-cyan-100 text-cyan-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Every 3 minutes
                </button>
                <button
                  onClick={() => { updateInterval(5); setShowIntervalDropdown(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSettings.screenshotInterval === 5
                      ? 'bg-cyan-100 text-cyan-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Every 5 minutes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter, Sort, Select Controls - Always visible */}
      {allPastSessions.length > 0 && (
        <>
          <div className="h-8 w-px bg-white/30"></div>

          {/* Filters Button */}
          <SessionsFilterMenu
            sessions={sessions}
            selectedCategories={selectedCategories}
            selectedSubCategories={selectedSubCategories}
            selectedTags={selectedTags}
            onCategoriesChange={onCategoriesChange}
            onSubCategoriesChange={onSubCategoriesChange}
            onTagsChange={onTagsChange}
          />

          {/* Sort Dropdown */}
          <SessionsSortMenu
            sortBy={sortBy}
            onSortChange={onSortChange}
          />

          {/* Select Button */}
          <motion.button
            layout
            onClick={() => {
              onBulkSelectModeChange(!bulkSelectMode);
              if (bulkSelectMode) {
                onSelectedSessionIdsChange(new Set());
              }
            }}
            className={`backdrop-blur-sm border-2 rounded-full text-sm font-semibold transition-all flex items-center ${
              bulkSelectMode
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md border-transparent'
                : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-cyan-300'
            } focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 outline-none`}
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '8px',
              paddingBottom: '8px',
            }}
            transition={{
              layout: {
                type: "spring",
                stiffness: 400,
                damping: 30,
              }
            }}
            title="Select multiple sessions"
          >
            <motion.div layout="position">
              <CheckCheck size={16} />
            </motion.div>
            <AnimatePresence mode="wait" initial={false}>
              {!compactMode && (
                <motion.span
                  key="select-label"
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{
                    opacity: 1,
                    width: 'auto',
                    marginLeft: '8px',
                    transition: {
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0,
                    transition: {
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                    }
                  }}
                >
                  {bulkSelectMode ? 'Cancel' : 'Select'}
                </motion.span>
              )}
            </AnimatePresence>
            {selectedSessionIds.size > 0 && (
              <motion.span
                layout="position"
                className="ml-1 px-1.5 py-0.5 bg-white/30 text-white text-[10px] font-bold rounded-full"
              >
                {selectedSessionIds.size}
              </motion.span>
            )}
          </motion.button>
        </>
      )}
    </>
  );

  return (
    <div className="flex items-center gap-3 bg-white/40 backdrop-blur-xl border-2 border-white/50 rounded-[24px] p-1.5 shadow-lg">
      {renderSessionControls()}
    </div>
  );
}
