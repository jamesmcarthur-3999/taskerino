import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare,
  CheckCircle2,
  Lightbulb,
  Camera,
  FileText,
  Coffee,
  Play,
  Target,
  Pause,
  Flag,
  ArrowRightLeft,
  Users,
  UserX,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type {
  TimelineModuleProps,
  TimelineEvent,
  TimelineEventType,
  FocusPeriod,
  EVENT_TYPE_CONFIG
} from '../types/module';
import { getGlassClasses, getRadiusClass } from '../../../design-system/theme';

// Icon component mapping
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  CheckSquare,
  CheckCircle2,
  Lightbulb,
  Camera,
  FileText,
  Coffee,
  Play,
  Target,
  Pause,
  Flag,
  ArrowRightLeft,
  Users,
  UserX,
  Clock
};

// Event type configuration
const EVENT_CONFIG: Record<TimelineEventType, { icon: string; color: string; label: string }> = {
  task_created: { icon: 'CheckSquare', color: '#3b82f6', label: 'Task Created' },
  task_completed: { icon: 'CheckCircle2', color: '#22c55e', label: 'Task Completed' },
  decision_made: { icon: 'Lightbulb', color: '#f59e0b', label: 'Decision Made' },
  screenshot_taken: { icon: 'Camera', color: '#8b5cf6', label: 'Screenshot' },
  note_added: { icon: 'FileText', color: '#06b6d4', label: 'Note Added' },
  break_started: { icon: 'Coffee', color: '#f97316', label: 'Break Started' },
  break_ended: { icon: 'Play', color: '#10b981', label: 'Break Ended' },
  focus_started: { icon: 'Target', color: '#ec4899', label: 'Focus Started' },
  focus_ended: { icon: 'Pause', color: '#6366f1', label: 'Focus Ended' },
  milestone_reached: { icon: 'Flag', color: '#ef4444', label: 'Milestone' },
  context_switch: { icon: 'ArrowRightLeft', color: '#64748b', label: 'Context Switch' },
  meeting_started: { icon: 'Users', color: '#0ea5e9', label: 'Meeting Started' },
  meeting_ended: { icon: 'UserX', color: '#71717a', label: 'Meeting Ended' }
};

// Tooltip Component
interface TooltipProps {
  event: TimelineEvent;
  position: { x: number; y: number };
}

const Tooltip: React.FC<TooltipProps> = ({ event, position }) => {
  const config = EVENT_CONFIG[event.type];
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
              {event.title}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {config.label}
            </div>
          </div>
        </div>
        {event.description && (
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            {event.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock size={10} />
          {new Date(event.timestamp).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Horizontal Timeline Component
const HorizontalTimeline: React.FC<TimelineModuleProps> = ({
  data,
  config,
  onEventClick,
  onTimeSeek
}) => {
  // Extract config settings with defaults
  const showDuration = config?.showDuration ?? true;
  const showFocusPeriods = config?.showFocusPeriods ?? true;
  const enableScrubbing = config?.enableScrubbing ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isScrolling, setIsScrolling] = useState(false);

  const sessionStart = new Date(data.sessionStart).getTime();
  const sessionEnd = new Date(data.sessionEnd).getTime();
  const totalDuration = sessionEnd - sessionStart;

  // Calculate event position as percentage
  const getEventPosition = (timestamp: string) => {
    const eventTime = new Date(timestamp).getTime();
    return ((eventTime - sessionStart) / totalDuration) * 100;
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

  // Handle event hover
  const handleEventHover = (event: TimelineEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredEvent(event);
  };

  // Handle scroll for scrubbing
  const handleScroll = () => {
    if (enableScrubbing) {
      setIsScrolling(true);
      setTimeout(() => setIsScrolling(false), 150);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Timeline Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-4"
      >
        <div className="relative min-w-full h-full px-8 py-6">
          {/* Time markers */}
          {showDuration && (
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
          )}

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

            {/* Focus periods */}
            {showFocusPeriods && data.focusPeriods && (
              <AnimatePresence>
                {data.focusPeriods.map((period, i) => {
                  const startPos = getEventPosition(period.startTime);
                  const endPos = getEventPosition(period.endTime);
                  const width = endPos - startPos;

                  const periodColors: Record<string, string> = {
                    focus: 'from-pink-400/30 to-purple-400/30',
                    break: 'from-orange-400/30 to-amber-400/30',
                    meeting: 'from-blue-400/30 to-cyan-400/30',
                    context_switch: 'from-gray-400/30 to-slate-400/30'
                  };

                  return (
                    <motion.div
                      key={period.id}
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                      className={`absolute top-1/2 h-8 bg-gradient-to-r ${periodColors[period.type]} ${getRadiusClass('pill')} origin-left backdrop-blur-sm`}
                      style={{
                        left: `${startPos}%`,
                        width: `${width}%`,
                        transform: 'translateY(-50%)'
                      }}
                    >
                      {period.label && (
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-gray-700 px-2 truncate">
                          {period.label}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}

            {/* Events */}
            <AnimatePresence>
              {data.events.map((event, i) => {
                const position = getEventPosition(event.timestamp);
                const eventConfig = EVENT_CONFIG[event.type];
                const IconComponent = ICON_MAP[eventConfig.icon];

                return (
                  <motion.div
                    key={event.id}
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
                    onMouseEnter={(e) => handleEventHover(event, e.currentTarget)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={() => onEventClick?.(event)}
                  >
                    {/* Event marker */}
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative w-10 h-10 ${getRadiusClass('pill')} shadow-lg transition-all duration-200 group-hover:shadow-xl`}
                      style={{
                        backgroundColor: 'white',
                        border: `3px solid ${eventConfig.color}`
                      }}
                    >
                      {/* Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {IconComponent && (
                          <div style={{ color: eventConfig.color }}>
                            <IconComponent size={18} />
                          </div>
                        )}
                      </div>

                      {/* Pulse effect */}
                      <motion.div
                        className={`absolute inset-0 ${getRadiusClass('pill')}`}
                        style={{ backgroundColor: eventConfig.color }}
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
                      style={{ backgroundColor: eventConfig.color }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Current time indicator (for active sessions) */}
            {data.currentTime && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{ left: `${getEventPosition(data.currentTime)}%` }}
              >
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Duration label */}
          {showDuration && (
            <div className="flex items-center justify-between mt-6 text-xs text-gray-500">
              <span>Start: {new Date(data.sessionStart).toLocaleTimeString()}</span>
              <span className="font-semibold">
                Duration: {Math.round(totalDuration / 60000)}m
              </span>
              <span>End: {new Date(data.sessionEnd).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredEvent && (
          <Tooltip event={hoveredEvent} position={tooltipPosition} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Vertical Timeline Component
const VerticalTimeline: React.FC<TimelineModuleProps> = ({
  data,
  config,
  onEventClick
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const sessionStart = new Date(data.sessionStart).getTime();
  const sessionEnd = new Date(data.sessionEnd).getTime();
  const totalDuration = sessionEnd - sessionStart;

  // Calculate event position as percentage
  const getEventPosition = (timestamp: string) => {
    const eventTime = new Date(timestamp).getTime();
    return ((eventTime - sessionStart) / totalDuration) * 100;
  };

  // Group events by proximity (within 5% of timeline)
  const groupedEvents = useMemo(() => {
    const groups: TimelineEvent[][] = [];
    const sortedEvents = [...data.events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedEvents.forEach(event => {
      const position = getEventPosition(event.timestamp);
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.length > 0) {
        const lastEventPos = getEventPosition(lastGroup[lastGroup.length - 1].timestamp);
        if (Math.abs(position - lastEventPos) < 5) {
          lastGroup.push(event);
          return;
        }
      }
      groups.push([event]);
    });

    return groups;
  }, [data.events, sessionStart, totalDuration]);

  const handleEventHover = (event: TimelineEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPosition({
      x: rect.right + 10,
      y: rect.top + rect.height / 2
    });
    setHoveredEvent(event);
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

          {/* Events */}
          <AnimatePresence>
            {groupedEvents.map((group, groupIndex) => {
              const primaryEvent = group[0];
              const position = getEventPosition(primaryEvent.timestamp);

              return (
                <div
                  key={`group-${groupIndex}`}
                  className="absolute left-0 right-0"
                  style={{ top: `${position}%` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Event markers */}
                    <div className="flex flex-col items-center gap-2">
                      {group.map((event, eventIndex) => {
                        const eventConfig = EVENT_CONFIG[event.type];
                        const IconComponent = ICON_MAP[eventConfig.icon];

                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, scale: 0, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{
                              duration: 0.4,
                              delay: 0.3 + groupIndex * 0.1 + eventIndex * 0.05,
                              type: 'spring',
                              stiffness: 300,
                              damping: 20
                            }}
                            className="relative cursor-pointer group"
                            onMouseEnter={(e) => handleEventHover(event, e.currentTarget)}
                            onMouseLeave={() => setHoveredEvent(null)}
                            onClick={() => onEventClick?.(event)}
                          >
                            <motion.div
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.95 }}
                              className="w-9 h-9 rounded-full shadow-md transition-all duration-200 group-hover:shadow-lg flex items-center justify-center"
                              style={{
                                backgroundColor: 'white',
                                border: `2.5px solid ${eventConfig.color}`
                              }}
                            >
                              {IconComponent && (
                                <div style={{ color: eventConfig.color }}>
                                  <IconComponent size={16} />
                                </div>
                              )}
                            </motion.div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Event content */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 + groupIndex * 0.1 }}
                      className={`flex-1 ${getGlassClasses('medium')} ${getRadiusClass('element')} p-3 shadow-sm hover:shadow-md transition-all duration-200`}
                    >
                      {group.map((event, eventIndex) => {
                        const eventConfig = EVENT_CONFIG[event.type];
                        return (
                          <div
                            key={event.id}
                            className={`${eventIndex > 0 ? 'mt-2 pt-2 border-t border-gray-200/50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-900 truncate">
                                  {event.title}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {eventConfig.label}
                                </div>
                                {event.description && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Clock size={10} />
                                {new Date(event.timestamp).toLocaleTimeString([], {
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
        {hoveredEvent && (
          <Tooltip event={hoveredEvent} position={tooltipPosition} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact Timeline Component
const CompactTimeline: React.FC<TimelineModuleProps> = ({
  data,
  config,
  onEventClick
}) => {
  // Extract config settings with defaults
  const showDuration = config?.showDuration ?? true;
  const showFocusPeriods = config?.showFocusPeriods ?? true;
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const sessionStart = new Date(data.sessionStart).getTime();
  const sessionEnd = new Date(data.sessionEnd).getTime();
  const totalDuration = sessionEnd - sessionStart;

  const getEventPosition = (timestamp: string) => {
    const eventTime = new Date(timestamp).getTime();
    return ((eventTime - sessionStart) / totalDuration) * 100;
  };

  const handleEventHover = (event: TimelineEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredEvent(event);
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

        {/* Focus periods overlay */}
        {showFocusPeriods && data.focusPeriods && (
          <div className="absolute top-1/2 left-4 right-4 h-2 transform -translate-y-1/2 overflow-hidden rounded-full">
            {data.focusPeriods.map((period, i) => {
              const startPos = getEventPosition(period.startTime);
              const endPos = getEventPosition(period.endTime);
              const width = endPos - startPos;

              const periodColors: Record<string, string> = {
                focus: 'bg-pink-400/60',
                break: 'bg-orange-400/60',
                meeting: 'bg-blue-400/60',
                context_switch: 'bg-gray-400/60'
              };

              return (
                <motion.div
                  key={period.id}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                  className={`absolute top-0 h-full ${periodColors[period.type]} origin-left`}
                  style={{
                    left: `${startPos}%`,
                    width: `${width}%`
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Event markers */}
        <AnimatePresence>
          {data.events.map((event, i) => {
            const position = getEventPosition(event.timestamp);
            const eventConfig = EVENT_CONFIG[event.type];

            return (
              <motion.div
                key={event.id}
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
                onMouseEnter={(e) => handleEventHover(event, e.currentTarget)}
                onMouseLeave={() => setHoveredEvent(null)}
                onClick={() => onEventClick?.(event)}
              >
                <motion.div
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-3 h-3 rounded-full shadow-md"
                  style={{
                    backgroundColor: eventConfig.color,
                    boxShadow: `0 0 8px ${eventConfig.color}50`
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Current time indicator */}
        {data.currentTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-1/2 w-1 h-4 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `calc(1rem + ${getEventPosition(data.currentTime)}% * (100% - 2rem) / 100)` }}
          >
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Duration info */}
      {showDuration && (
        <div className="flex items-center justify-center mt-2 text-[10px] text-gray-500">
          <span className="font-medium">
            {Math.round(totalDuration / 60000)}m session • {data.events.length} events
          </span>
        </div>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredEvent && (
          <Tooltip event={hoveredEvent} position={tooltipPosition} />
        )}
      </AnimatePresence>
    </div>
  );
};

// Main Timeline Module Component
export const TimelineModule: React.FC<TimelineModuleProps> = (props) => {
  const { variant = 'horizontal', className = '' } = props;

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
    ${className}
  `;

  return (
    <div className={containerClasses}>
      {effectiveVariant === 'horizontal' && <HorizontalTimeline {...props} />}
      {effectiveVariant === 'vertical' && <VerticalTimeline {...props} />}
      {effectiveVariant === 'compact' && <CompactTimeline {...props} />}
    </div>
  );
};

export default TimelineModule;
