import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Trophy,
  AlertCircle,
  Lightbulb,
  Mic,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { Session } from '../../../types';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

// Timeline moment types for session data
type TimelineMomentType = 'screenshot_captured' | 'achievement' | 'blocker' | 'insight' | 'audio_segment';

// Timeline moment interface
interface TimelineMoment {
  id: string;
  type: TimelineMomentType;
  timestamp: string;
  title: string;
  description?: string;
}

// Props interface for ArtifactTimelineModule
interface ArtifactTimelineProps {
  session: Session;
  variant?: 'horizontal' | 'vertical' | 'compact';
  onClickMoment?: (moment: TimelineMoment) => void;
  theme?: ThemeConfig;
}

// Theme configuration interface
interface ThemeConfig {
  primary?: string;
  background?: string;
  text?: string;
}

// Icon component mapping
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Camera,
  Trophy,
  AlertCircle,
  Lightbulb,
  Mic,
  Clock
};

// Event type configuration with specified colors
const EVENT_CONFIG: Record<TimelineMomentType, { icon: string; color: string; label: string }> = {
  screenshot_captured: { icon: 'Camera', color: '#3b82f6', label: 'Screenshot' },
  achievement: { icon: 'Trophy', color: '#22c55e', label: 'Achievement' },
  blocker: { icon: 'AlertCircle', color: '#ef4444', label: 'Blocker' },
  insight: { icon: 'Lightbulb', color: '#f59e0b', label: 'Insight' },
  audio_segment: { icon: 'Mic', color: '#8b5cf6', label: 'Audio Recording' }
};

// Convert session data to timeline moments
function sessionToTimelineMoments(session: Session): TimelineMoment[] {
  const moments: TimelineMoment[] = [];

  // Add screenshots
  if (session.screenshots) {
    session.screenshots.forEach(screenshot => {
      moments.push({
        id: screenshot.id,
        type: 'screenshot_captured',
        timestamp: screenshot.timestamp,
        title: screenshot.aiAnalysis?.summary || 'Screenshot captured',
        description: screenshot.aiAnalysis?.detectedActivity
      });
    });
  }

  // Add achievements from summary
  if (session.summary?.achievements) {
    session.summary.achievements.forEach((achievement, index) => {
      moments.push({
        id: `achievement-${index}`,
        type: 'achievement',
        timestamp: session.startTime, // Use session start as fallback
        title: achievement,
        description: 'Achievement unlocked'
      });
    });
  }

  // Add blockers from summary
  if (session.summary?.blockers) {
    session.summary.blockers.forEach((blocker, index) => {
      moments.push({
        id: `blocker-${index}`,
        type: 'blocker',
        timestamp: session.startTime, // Use session start as fallback
        title: blocker,
        description: 'Blocker encountered'
      });
    });
  }

  // Add key insights from summary
  if (session.summary?.keyInsights) {
    session.summary.keyInsights.forEach(insight => {
      moments.push({
        id: `insight-${insight.timestamp}`,
        type: 'insight',
        timestamp: insight.timestamp,
        title: insight.insight,
        description: 'Key insight'
      });
    });
  }

  // Add audio segments
  if (session.audioSegments) {
    session.audioSegments.forEach(segment => {
      moments.push({
        id: segment.id,
        type: 'audio_segment',
        timestamp: segment.timestamp,
        title: segment.transcription.slice(0, 50) + (segment.transcription.length > 50 ? '...' : ''),
        description: `Audio recording (${segment.duration}s)`
      });
    });
  }

  // Sort by timestamp
  return moments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Tooltip Component
interface TooltipProps {
  moment: TimelineMoment;
  position: { x: number; y: number };
}

const Tooltip: React.FC<TooltipProps> = ({ moment, position }) => {
  const config = EVENT_CONFIG[moment.type];
  const IconComponent = ICON_MAP[config.icon];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 10}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <div className={`${getGlassClasses('extra-strong')} ${getRadiusClass('element')} p-3 min-w-[200px] max-w-[300px]`}>
        <div className="flex items-start gap-2 mb-2">
          <div
            className={`p-1.5 ${getRadiusClass('element')} flex-shrink-0`}
            style={{ backgroundColor: `${config.color}20` }}
          >
            {IconComponent && <div style={{ color: config.color }}><IconComponent size={14} /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-900 truncate">
              {moment.title}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {config.label}
            </div>
          </div>
        </div>
        {moment.description && (
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            {moment.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock size={10} />
          {new Date(moment.timestamp).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Horizontal Timeline Component
const HorizontalTimeline: React.FC<{ session: Session; onClickMoment?: (moment: TimelineMoment) => void }> = ({
  session,
  onClickMoment
}) => {
  const moments = useMemo(() => sessionToTimelineMoments(session), [session]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMoment, setHoveredMoment] = useState<TimelineMoment | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const sessionStart = new Date(session.startTime).getTime();
  const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : Date.now();
  const totalDuration = sessionEnd - sessionStart;

  // Calculate moment position as percentage
  const getMomentPosition = (timestamp: string) => {
    const momentTime = new Date(timestamp).getTime();
    return ((momentTime - sessionStart) / totalDuration) * 100;
  };

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const markerCount = 6;
    for (let i = 0; i <= markerCount; i++) {
      const percentage = (i / markerCount) * 100;
      const time = new Date(sessionStart + (totalDuration * i / markerCount));
      markers.push({ percentage, time });
    }
    return markers;
  }, [sessionStart, totalDuration]);

  // Handle moment hover
  const handleMomentHover = (moment: TimelineMoment, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredMoment(moment);
  };

  return (
    <div className="relative w-full h-full">
      {/* Timeline Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-4"
      >
        <div className="relative min-w-full h-full px-8 py-6">
          {/* Time markers */}
          <div className="relative w-full mb-6">
            {timeMarkers.map((marker, i) => (
              <div
                key={i}
                className="absolute transform -translate-x-1/2"
                style={{ left: `${marker.percentage}%` }}
              >
                <div className="text-[10px] text-gray-400 font-medium">
                  {marker.time.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline axis */}
          <div className="relative w-full" style={{ height: '120px' }}>
            {/* Base line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 origin-left"
              style={{ transform: 'translateY(-50%)' }}
            />

            {/* Moments */}
            <AnimatePresence>
              {moments.map((moment, i) => {
                const position = getMomentPosition(moment.timestamp);
                const momentConfig = EVENT_CONFIG[moment.type];
                const IconComponent = ICON_MAP[momentConfig.icon];

                return (
                  <motion.div
                    key={moment.id}
                    initial={{ opacity: 0, scale: 0, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.6 + i * 0.05,
                      type: 'spring',
                      stiffness: 300,
                      damping: 20
                    }}
                    className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                    style={{ left: `${position}%` }}
                    onMouseEnter={(e) => handleMomentHover(moment, e.currentTarget)}
                    onMouseLeave={() => setHoveredMoment(null)}
                    onClick={() => onClickMoment?.(moment)}
                  >
                    {/* Moment marker */}
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative w-10 h-10 ${getRadiusClass('pill')} shadow-lg transition-all duration-200 group-hover:shadow-xl`}
                      style={{
                        backgroundColor: 'white',
                        border: `3px solid ${momentConfig.color}`
                      }}
                    >
                      {/* Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {IconComponent && (
                          <div style={{ color: momentConfig.color }}>
                            <IconComponent size={18} />
                          </div>
                        )}
                      </div>

                      {/* Pulse effect */}
                      <motion.div
                        className={`absolute inset-0 ${getRadiusClass('pill')}`}
                        style={{ backgroundColor: momentConfig.color }}
                        initial={{ opacity: 0.5, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: 'easeOut'
                        }}
                      />
                    </motion.div>

                    {/* Connection line */}
                    <div
                      className="absolute top-full left-1/2 w-0.5 h-4 transform -translate-x-1/2 transition-all duration-200 group-hover:h-6"
                      style={{ backgroundColor: momentConfig.color }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Duration label */}
          <div className="flex items-center justify-between mt-6 text-xs text-gray-500">
            <span>Start: {new Date(session.startTime).toLocaleTimeString()}</span>
            <span className="font-semibold">
              Duration: {Math.round(totalDuration / 60000)}m
            </span>
            <span>End: {session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Ongoing'}</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredMoment && (
          <Tooltip moment={hoveredMoment} position={tooltipPosition} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Vertical Timeline Component
const VerticalTimeline: React.FC<{ session: Session; onClickMoment?: (moment: TimelineMoment) => void }> = ({
  session,
  onClickMoment
}) => {
  const moments = useMemo(() => sessionToTimelineMoments(session), [session]);
  const [hoveredMoment, setHoveredMoment] = useState<TimelineMoment | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const sessionStart = new Date(session.startTime).getTime();
  const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : Date.now();
  const totalDuration = sessionEnd - sessionStart;

  // Calculate moment position as percentage
  const getMomentPosition = (timestamp: string) => {
    const momentTime = new Date(timestamp).getTime();
    return ((momentTime - sessionStart) / totalDuration) * 100;
  };

  // Group moments by proximity (within 5% of timeline)
  const groupedMoments = useMemo(() => {
    const groups: TimelineMoment[][] = [];
    const sortedMoments = [...moments];

    sortedMoments.forEach(moment => {
      const position = getMomentPosition(moment.timestamp);
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.length > 0) {
        const lastMomentPos = getMomentPosition(lastGroup[lastGroup.length - 1].timestamp);
        if (Math.abs(position - lastMomentPos) < 5) {
          lastGroup.push(moment);
          return;
        }
      }
      groups.push([moment]);
    });

    return groups;
  }, [moments, sessionStart, totalDuration]);

  const handleMomentHover = (moment: TimelineMoment, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPosition({
      x: rect.right + 10,
      y: rect.top + rect.height / 2
    });
    setHoveredMoment(moment);
  };

  return (
    <div className="relative w-full h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
      <div className="relative min-h-full px-8 py-6">
        {/* Timeline axis */}
        <div className="relative" style={{ minHeight: '500px' }}>
          {/* Base line */}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-300 via-blue-400 to-cyan-300 origin-top"
          />

          {/* Moments */}
          <AnimatePresence>
            {groupedMoments.map((group, groupIndex) => {
              const primaryMoment = group[0];
              const position = getMomentPosition(primaryMoment.timestamp);

              return (
                <div
                  key={`group-${groupIndex}`}
                  className="absolute left-0 right-0"
                  style={{ top: `${position}%` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Moment markers */}
                    <div className="flex flex-col items-center gap-2">
                      {group.map((moment, momentIndex) => {
                        const momentConfig = EVENT_CONFIG[moment.type];
                        const IconComponent = ICON_MAP[momentConfig.icon];

                        return (
                          <motion.div
                            key={moment.id}
                            initial={{ opacity: 0, scale: 0, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{
                              duration: 0.4,
                              delay: 0.3 + groupIndex * 0.1 + momentIndex * 0.05,
                              type: 'spring',
                              stiffness: 300,
                              damping: 20
                            }}
                            className="relative cursor-pointer group"
                            onMouseEnter={(e) => handleMomentHover(moment, e.currentTarget)}
                            onMouseLeave={() => setHoveredMoment(null)}
                            onClick={() => onClickMoment?.(moment)}
                          >
                            <motion.div
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-9 h-9 rounded-full shadow-md transition-all duration-200 group-hover:shadow-lg flex items-center justify-center"
                              style={{
                                backgroundColor: 'white',
                                border: `2.5px solid ${momentConfig.color}`
                              }}
                            >
                              {IconComponent && (
                                <div style={{ color: momentConfig.color }}>
                                  <IconComponent size={16} />
                                </div>
                              )}
                            </motion.div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Moment content */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 + groupIndex * 0.1 }}
                      className={`flex-1 ${getGlassClasses('medium')} ${getRadiusClass('element')} p-3 shadow-sm hover:shadow-md transition-all duration-200`}
                    >
                      {group.map((moment, momentIndex) => {
                        const momentConfig = EVENT_CONFIG[moment.type];
                        return (
                          <div
                            key={moment.id}
                            className={`${momentIndex > 0 ? 'mt-2 pt-2 border-t border-gray-200/50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-900 truncate">
                                  {moment.title}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {momentConfig.label}
                                </div>
                                {moment.description && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {moment.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Clock size={10} />
                                {new Date(moment.timestamp).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredMoment && (
          <Tooltip moment={hoveredMoment} position={tooltipPosition} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact Timeline Component
const CompactTimeline: React.FC<{ session: Session; onClickMoment?: (moment: TimelineMoment) => void }> = ({
  session,
  onClickMoment
}) => {
  const moments = useMemo(() => sessionToTimelineMoments(session), [session]);
  const [hoveredMoment, setHoveredMoment] = useState<TimelineMoment | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const sessionStart = new Date(session.startTime).getTime();
  const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : Date.now();
  const totalDuration = sessionEnd - sessionStart;

  const getMomentPosition = (timestamp: string) => {
    const momentTime = new Date(timestamp).getTime();
    return ((momentTime - sessionStart) / totalDuration) * 100;
  };

  const handleMomentHover = (moment: TimelineMoment, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredMoment(moment);
  };

  return (
    <div className="relative w-full h-full">
      <div className="relative w-full h-12 px-4">
        {/* Progress bar background */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute top-1/2 left-4 right-4 h-2 bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-200 rounded-full transform -translate-y-1/2 origin-left"
        />

        {/* Moment markers */}
        <AnimatePresence>
          {moments.map((moment, i) => {
            const position = getMomentPosition(moment.timestamp);
            const momentConfig = EVENT_CONFIG[moment.type];

            return (
              <motion.div
                key={moment.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  delay: 0.6 + i * 0.03,
                  type: 'spring',
                  stiffness: 400,
                  damping: 25
                }}
                className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `calc(1rem + ${position}% * (100% - 2rem) / 100)` }}
                onMouseEnter={(e) => handleMomentHover(moment, e.currentTarget)}
                onMouseLeave={() => setHoveredMoment(null)}
                onClick={() => onClickMoment?.(moment)}
              >
                <motion.div
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-3 h-3 rounded-full shadow-md"
                  style={{
                    backgroundColor: momentConfig.color,
                    boxShadow: `0 0 8px ${momentConfig.color}50`
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Duration info */}
      <div className="flex items-center justify-center mt-2 text-[10px] text-gray-500">
        <span className="font-medium">
          {Math.round(totalDuration / 60000)}m session • {moments.length} moments
        </span>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredMoment && (
          <Tooltip moment={hoveredMoment} position={tooltipPosition} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Main ArtifactTimelineModule Component
export const ArtifactTimelineModule: React.FC<ArtifactTimelineProps> = (props) => {
  const { session, variant = 'horizontal', onClickMoment, theme } = props;

  // Responsive variant selection
  const [effectiveVariant, setEffectiveVariant] = useState(variant);

  useEffect(() => {
    const handleResize = () => {
      if (variant === 'horizontal' && window.innerWidth < 768) {
        setEffectiveVariant('vertical');
      } else {
        setEffectiveVariant(variant);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [variant]);

  const containerClasses = `
    relative w-full h-full
    ${getGlassClasses('medium')}
    ${getRadiusClass('card')}
    shadow-lg overflow-hidden
  `;

  return (
    <div className={containerClasses} style={theme ? { backgroundColor: theme.background, color: theme.text } : undefined}>
      {effectiveVariant === 'horizontal' && <HorizontalTimeline session={session} onClickMoment={onClickMoment} />}
      {effectiveVariant === 'vertical' && <VerticalTimeline session={session} onClickMoment={onClickMoment} />}
      {effectiveVariant === 'compact' && <CompactTimeline session={session} onClickMoment={onClickMoment} />}
    </div>
  );
};

export default ArtifactTimelineModule;
