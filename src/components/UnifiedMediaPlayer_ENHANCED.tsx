// This is a temporary file with the enhanced UnifiedTimeline component
// To be merged into UnifiedMediaPlayer.tsx

interface TimelineTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
}

function TimelineTooltip({ visible, x, y, content }: TimelineTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none transition-opacity duration-150"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="mb-2 bg-gray-900/95 backdrop-blur-md text-white px-3 py-2 rounded-lg shadow-2xl border border-white/20 max-w-xs">
        {content}
      </div>
    </div>
  );
}

function UnifiedTimeline({
  currentTime,
  duration,
  screenshots,
  audioSegments,
  keyMoments,
  session,
  onSeek,
}: UnifiedTimelineProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredScreenshot, setHoveredScreenshot] = useState<SessionScreenshot | null>(null);
  const [hoveredMoment, setHoveredMoment] = useState<AudioKeyMoment | null>(null);
  const [screenshotThumbnails, setScreenshotThumbnails] = useState<Map<string, string>>(new Map());

  // Calculate progress percentage with safeguards
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Load screenshot thumbnail on hover
  useEffect(() => {
    if (!hoveredScreenshot) return;

    const loadThumbnail = async () => {
      if (screenshotThumbnails.has(hoveredScreenshot.id)) return;

      try {
        const attachment = await attachmentStorage.getAttachment(hoveredScreenshot.attachmentId);
        if (attachment?.path) {
          const url = convertFileSrc(attachment.path);
          setScreenshotThumbnails((prev) => new Map(prev).set(hoveredScreenshot.id, url));
        }
      } catch (err) {
        console.error('[TIMELINE] Failed to load screenshot thumbnail:', err);
      }
    };

    loadThumbnail();
  }, [hoveredScreenshot, screenshotThumbnails]);

  const getTimeFromMouseEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent): number => {
    const slider = sliderRef.current;
    if (!slider || duration === 0) return 0;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return percent * duration;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const time = getTimeFromMouseEvent(e);
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    const time = getTimeFromMouseEvent(e);

    setPreviewTime(time);
    setHoverPosition({
      x: e.clientX,
      y: rect.top,
    });

    if (isDragging) {
      onSeek(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setPreviewTime(null);
    setHoverPosition(null);
    setHoveredScreenshot(null);
    setHoveredMoment(null);
    setIsDragging(false);
  };

  // Global mouse up listener for dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const getMomentColor = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'bg-green-500';
      case 'blocker':
        return 'bg-red-500';
      case 'decision':
        return 'bg-purple-500';
      case 'insight':
        return 'bg-blue-500';
      default:
        return 'bg-amber-500';
    }
  };

  const getMomentColorBorder = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'border-green-500';
      case 'blocker':
        return 'border-red-500';
      case 'decision':
        return 'border-purple-500';
      case 'insight':
        return 'border-blue-500';
      default:
        return 'border-amber-500';
    }
  };

  const getMomentTypeLabel = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'Achievement';
      case 'blocker':
        return 'Blocker';
      case 'decision':
        return 'Decision';
      case 'insight':
        return 'Insight';
      default:
        return type;
    }
  };

  return (
    <div className="relative">
      {/* Key Moment Markers Row */}
      {keyMoments.length > 0 && (
        <div className="relative h-6 mb-2">
          {keyMoments.map((moment) => {
            const position = (moment.timestamp / duration) * 100;
            const colorClass = getMomentColor(moment.type);
            const isHovered = hoveredMoment?.id === moment.id;

            return (
              <div
                key={moment.id}
                className="absolute top-0"
                style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                onMouseEnter={(e) => {
                  setHoveredMoment(moment);
                  setHoverPosition({ x: e.clientX, y: e.currentTarget.getBoundingClientRect().top });
                }}
                onMouseLeave={() => setHoveredMoment(null)}
                onClick={() => onSeek(moment.timestamp)}
              >
                <div
                  className={`${colorClass} rounded-full shadow-md cursor-pointer transition-all ${
                    isHovered ? 'w-3 h-3' : 'w-2 h-2'
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Slider Track */}
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-3 bg-white/40 backdrop-blur-md rounded-full border border-white/50 shadow-inner cursor-pointer hover:bg-white/50 transition-colors"
      >
        {/* Progress Fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full pointer-events-none will-change-[width]"
          style={{
            width: `${progressPercent}%`,
            transition: 'width 0.1s linear'
          }}
        />

        {/* Preview Line (on hover) */}
        {previewTime !== null && !isDragging && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white/60 pointer-events-none z-10"
            style={{ left: `${(previewTime / duration) * 100}%` }}
          />
        )}

        {/* Screenshot Markers */}
        {screenshots.map((screenshot) => {
          const sessionStart = new Date(session.startTime).getTime();
          const screenshotTime = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
          const position = (screenshotTime / duration) * 100;

          if (position < 0 || position > 100) return null;

          const isHovered = hoveredScreenshot?.id === screenshot.id;

          return (
            <div
              key={screenshot.id}
              className={`absolute top-1/2 bg-blue-400 rounded-full shadow-sm cursor-pointer transition-all z-10 ${
                isHovered ? 'w-3 h-3' : 'w-1.5 h-1.5'
              }`}
              style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
              onMouseEnter={(e) => {
                setHoveredScreenshot(screenshot);
                setHoverPosition({ x: e.clientX, y: e.currentTarget.getBoundingClientRect().top });
              }}
              onMouseLeave={() => setHoveredScreenshot(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(screenshotTime);
              }}
            />
          );
        })}

        {/* Playhead */}
        <div
          className="absolute w-5 h-5 bg-white/95 backdrop-blur-sm rounded-full shadow-2xl border-2 border-cyan-500 pointer-events-none z-20 will-change-[left]"
          style={{
            left: `${progressPercent}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.1s linear'
          }}
        />
      </div>

      {/* Tooltips */}
      {hoveredScreenshot && hoverPosition && (
        <TimelineTooltip
          visible={true}
          x={hoverPosition.x}
          y={hoverPosition.y}
          content={
            <div className="space-y-2">
              <div className="text-xs font-mono text-cyan-400">
                {formatTimeSimple(
                  (new Date(hoveredScreenshot.timestamp).getTime() - new Date(session.startTime).getTime()) / 1000
                )}
              </div>
              {screenshotThumbnails.has(hoveredScreenshot.id) && (
                <img
                  src={screenshotThumbnails.get(hoveredScreenshot.id)}
                  alt="Screenshot preview"
                  className="w-48 h-auto rounded border border-white/20"
                />
              )}
              {hoveredScreenshot.aiAnalysis?.summary && (
                <div className="text-xs text-gray-300 max-w-48">
                  {hoveredScreenshot.aiAnalysis.summary}
                </div>
              )}
              <div className="text-xs text-gray-400">Click to seek</div>
            </div>
          }
        />
      )}

      {hoveredMoment && hoverPosition && (
        <TimelineTooltip
          visible={true}
          x={hoverPosition.x}
          y={hoverPosition.y}
          content={
            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-400">
                {formatTimeSimple(hoveredMoment.timestamp)}
              </div>
              <div className={`text-xs font-semibold px-2 py-0.5 rounded border ${getMomentColorBorder(hoveredMoment.type)} inline-block`}>
                {getMomentTypeLabel(hoveredMoment.type)}
              </div>
              <div className="text-sm font-semibold">{hoveredMoment.label}</div>
              {hoveredMoment.excerpt && (
                <div className="text-xs text-gray-300 max-w-48 mt-1">
                  {hoveredMoment.excerpt}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">Click to seek</div>
            </div>
          }
        />
      )}

      {previewTime !== null && !hoveredScreenshot && !hoveredMoment && hoverPosition && (
        <TimelineTooltip
          visible={true}
          x={hoverPosition.x}
          y={hoverPosition.y}
          content={
            <div className="text-xs font-mono">
              {formatTimeSimple(previewTime)}
            </div>
          }
        />
      )}
    </div>
  );
}
