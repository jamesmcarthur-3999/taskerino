import { useEffect, useState } from 'react';
import { Activity, Play, Pause, Square, Clock, Volume2, VolumeX } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useSession } from '../hooks/useSession';
import { useUI } from '../context/UIContext';
import { audioStorageService } from '../services/audioStorageService';
import { getGlassClasses, SHADOWS, TRANSITIONS } from '../design-system/theme';

/**
 * ActiveSessionIndicator
 *
 * Shows in the top bar when a session is active.
 * Displays session name, duration, and quick controls.
 */
export function ActiveSessionIndicator() {
  const { activeSession, isSessionActive, pauseSession, resumeSession, endSession, getSessionDuration, updateSession } = useSession();
  const { dispatch: uiDispatch, addNotification } = useUI();
  const [duration, setDuration] = useState(0);
  const [isStitching, setIsStitching] = useState(false);
  const [lastChunkWasSilent, setLastChunkWasSilent] = useState<boolean | null>(null);

  // Update duration every second
  useEffect(() => {
    if (!activeSession) return;

    const updateDuration = () => {
      setDuration(getSessionDuration(activeSession));
    };

    updateDuration(); // Initial update
    const interval = setInterval(updateDuration, 1000); // Update every second

    return () => clearInterval(interval);
  }, [activeSession, getSessionDuration]);

  // Listen for audio chunks to track VAD status
  useEffect(() => {
    if (!activeSession || !activeSession.audioRecording) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<{ isSilent?: boolean }>('audio-chunk', (event) => {
        if (event.payload.isSilent !== undefined) {
          setLastChunkWasSilent(event.payload.isSilent);
          // Auto-clear after 3 seconds to avoid stale indicator
          setTimeout(() => setLastChunkWasSilent(null), 3000);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeSession]);

  if (!activeSession) return null;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleViewSession = () => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
  };

  // Handle ending session with audio stitching
  const handleEndSession = async () => {
    if (!activeSession) return;

    if (!confirm(`End session "${activeSession.name}"?`)) {
      return;
    }

    try {
      setIsStitching(true);

      // Stitch audio segments if there are any
      const audioSegments = activeSession.audioSegments || [];
      if (audioSegments.length > 0) {
        console.log(`🎵 [SESSION END] Stitching ${audioSegments.length} audio segments...`);

        // Get attachment IDs from segments (filter out deleted audio)
        const attachmentIds = audioSegments
          .filter(seg => seg.attachmentId)
          .map(seg => seg.attachmentId!);

        if (attachmentIds.length > 0) {
          try {
            const fullAudioAttachment = await audioStorageService.stitchAudioSegments(
              attachmentIds,
              activeSession.id
            );

            // Update session with full audio attachment ID
            updateSession({
              ...activeSession,
              fullAudioAttachmentId: fullAudioAttachment.id,
            });

            console.log(`✅ [SESSION END] Audio stitched: ${fullAudioAttachment.id}`);

            addNotification({
              type: 'success',
              title: 'Audio Stitched',
              message: `Combined ${attachmentIds.length} audio segments into full session recording`,
            });
          } catch (error) {
            console.error('❌ [SESSION END] Failed to stitch audio:', error);
            addNotification({
              type: 'error',
              title: 'Audio Stitching Failed',
              message: 'Could not combine audio segments. Session will end without full audio.',
            });
          }
        }
      }

      // End the session
      endSession();
    } finally {
      setIsStitching(false);
    }
  };

  return (
    <div
      onClick={handleViewSession}
      className={`flex items-center gap-2 px-3 py-2 ${getGlassClasses('strong')} rounded-2xl ${SHADOWS.elevated}
                 ring-1 ring-black/5 ${TRANSITIONS.standard} hover:scale-105
                 hover:shadow-2xl cursor-pointer group`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      title="Click to view session details"
    >
      {/* Status Indicator */}
      <div className="relative flex items-center justify-center">
        <div className={`w-2 h-2 rounded-full ${
          isSessionActive ? 'bg-green-500' : 'bg-yellow-500'
        }`}>
          {isSessionActive && (
            <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
          )}
        </div>
      </div>

      {/* Session Icon */}
      <Activity className={`w-4 h-4 ${
        isSessionActive ? 'text-green-600' : 'text-yellow-600'
      }`} />

      {/* Session Info */}
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-gray-900 leading-none">
          {activeSession.name}
        </span>
        <span className="text-xs text-gray-500 leading-none mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(duration)}
          {/* VAD indicator - shows when AI analysis is skipped */}
          {lastChunkWasSilent === true && activeSession.audioRecording && (
            <span className="flex items-center gap-0.5 text-orange-600 ml-1" title="Skipping transcription (silence detected)">
              <VolumeX className="w-3 h-3" />
              <span className="text-[10px] font-medium">Skip AI</span>
            </span>
          )}
          {lastChunkWasSilent === false && activeSession.audioRecording && (
            <span className="flex items-center gap-0.5 text-green-600 ml-1" title="Transcribing audio">
              <Volume2 className="w-3 h-3" />
              <span className="text-[10px] font-medium">AI Active</span>
            </span>
          )}
        </span>
      </div>

      {/* Quick Controls */}
      <div className={`flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 ${TRANSITIONS.opacity}`}
           onClick={(e) => e.stopPropagation()}>
        {isSessionActive ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              pauseSession();
            }}
            className={`p-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700 rounded-lg ${TRANSITIONS.colors}`}
            title="Pause session"
          >
            <Pause className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resumeSession();
            }}
            className={`p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-700 rounded-lg ${TRANSITIONS.colors}`}
            title="Resume session"
          >
            <Play className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEndSession();
          }}
          disabled={isStitching}
          className={`p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-700 rounded-lg
                   ${TRANSITIONS.colors} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isStitching ? "Stitching audio..." : "End session"}
        >
          {isStitching ? (
            <div className="w-3 h-3 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
}
