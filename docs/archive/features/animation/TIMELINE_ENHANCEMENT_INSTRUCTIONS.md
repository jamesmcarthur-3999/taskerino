# Timeline Markers Enhancement - Implementation Guide

## Overview
This document describes the enhancements made to the UnifiedMediaPlayer's timeline markers to add hover information and smooth seeking functionality.

## File to Modify
`/Users/jamesmcarthur/Documents/taskerino/src/components/UnifiedMediaPlayer.tsx`

## Changes Required

### 1. Add TimelineTooltip Component (Before UnifiedTimeline function, around line 784)

Add this new component interface and function:

```typescript
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
```

### 2. Enhance UnifiedTimeline Component

Replace the existing `UnifiedTimeline` function (starts around line 795) with the enhanced version from `/Users/jamesmcarthur/Documents/taskerino/src/components/UnifiedMediaPlayer_ENHANCED.tsx`.

#### Key Additions to UnifiedTimeline:

**New State Variables:**
```typescript
const [isDragging, setIsDragging] = useState(false);
const [previewTime, setPreviewTime] = useState<number | null>(null);
const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
const [hoveredScreenshot, setHoveredScreenshot] = useState<SessionScreenshot | null>(null);
const [hoveredMoment, setHoveredMoment] = useState<AudioKeyMoment | null>(null);
const [screenshotThumbnails, setScreenshotThumbnails] = useState<Map<string, string>>(new Map());
```

**New Helper Functions:**
```typescript
const getMomentColorBorder = (type: string) => { /* ... */ };
const getMomentTypeLabel = (type: string) => { /* ... */ };
const getTimeFromMouseEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent): number => { /* ... */ };
```

**New Event Handlers:**
```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { /* ... */ };
const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { /* ... */ };
const handleMouseUp = () => { /* ... */ };
const handleMouseLeave = () => { /* ... */ };
```

**New useEffect for Screenshot Loading:**
```typescript
useEffect(() => {
  if (!hoveredScreenshot) return;
  const loadThumbnail = async () => { /* ... */ };
  loadThumbnail();
}, [hoveredScreenshot, screenshotThumbnails]);
```

**New useEffect for Drag Handling:**
```typescript
useEffect(() => {
  if (isDragging) {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }
}, [isDragging]);
```

### 3. Update Slider Track Event Handlers

Change the slider track div from:
```typescript
<div
  ref={sliderRef}
  onClick={handleSliderClick}
  className="relative h-3 bg-white/40..."
>
```

To:
```typescript
<div
  ref={sliderRef}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
  className="relative h-3 bg-white/40..."
>
```

### 4. Add Preview Line to Slider Track

After the Progress Fill div, add:
```typescript
{/* Preview Line (on hover) */}
{previewTime !== null && !isDragging && (
  <div
    className="absolute inset-y-0 w-0.5 bg-white/60 pointer-events-none z-10"
    style={{ left: `${(previewTime / duration) * 100}%` }}
  />
)}
```

### 5. Enhance Key Moment Markers

Update the key moment markers to include hover effects:
```typescript
{keyMoments.map((moment) => {
  const position = (moment.timestamp / duration) * 100;
  const colorClass = getMomentColor(moment.type);
  const isHovered = hoveredMoment?.id === moment.id;  // ADD THIS

  return (
    <div
      key={moment.id}
      className="absolute top-0"
      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      onMouseEnter={(e) => {  // ADD THIS
        setHoveredMoment(moment);
        setHoverPosition({ x: e.clientX, y: e.currentTarget.getBoundingClientRect().top });
      }}
      onMouseLeave={() => setHoveredMoment(null)}  // ADD THIS
      onClick={() => onSeek(moment.timestamp)}  // ADD THIS
    >
      <div
        className={`${colorClass} rounded-full shadow-md cursor-pointer transition-all ${
          isHovered ? 'w-3 h-3' : 'w-2 h-2'  // MODIFY THIS
        }`}
      />
    </div>
  );
})}
```

### 6. Enhance Screenshot Markers

Update screenshot markers to be interactive:
```typescript
{screenshots.map((screenshot) => {
  const sessionStart = new Date(session.startTime).getTime();
  const screenshotTime = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
  const position = (screenshotTime / duration) * 100;

  if (position < 0 || position > 100) return null;

  const isHovered = hoveredScreenshot?.id === screenshot.id;  // ADD THIS

  return (
    <div
      key={screenshot.id}
      className={`absolute top-1/2 bg-blue-400 rounded-full shadow-sm cursor-pointer transition-all z-10 ${
        isHovered ? 'w-3 h-3' : 'w-1.5 h-1.5'  // MODIFY THIS - make clickable and reactive
      }`}
      style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
      onMouseEnter={(e) => {  // ADD THIS
        setHoveredScreenshot(screenshot);
        setHoverPosition({ x: e.clientX, y: e.currentTarget.getBoundingClientRect().top });
      }}
      onMouseLeave={() => setHoveredScreenshot(null)}  // ADD THIS
      onClick={(e) => {  // ADD THIS
        e.stopPropagation();
        onSeek(screenshotTime);
      }}
    />
  );
})}
```

### 7. Add Tooltip Renderers

At the end of the UnifiedTimeline return statement, after the slider track closing div, add:

```typescript
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
```

## Features Implemented

### 1. Screenshot Marker Hover Information
- Shows timestamp
- Displays screenshot thumbnail (loaded on demand)
- Shows AI analysis summary (if available)
- "Click to seek" instruction

### 2. Key Moment Marker Hover Information
- Shows timestamp
- Displays moment type (Achievement/Blocker/Decision/Insight)
- Shows moment label/title
- Shows excerpt/description (if available)
- "Click to seek" instruction

### 3. Smooth Timeline Seeking
- Drag to scrub through timeline
- Shows preview line at mouse position when hovering
- Shows timestamp tooltip at hover position
- Global mouse up handler for smooth drag experience

### 4. Visual Polish
- Markers grow on hover (1.5px → 3px for screenshots, 2px → 3px for key moments)
- Smooth transitions for all animations
- Dark tooltip with backdrop blur
- Proper z-indexing to prevent overlaps
- Cursor changes to pointer on interactive elements

## Testing Checklist

- [ ] Screenshot markers show tooltip on hover with thumbnail
- [ ] Key moment markers show tooltip on hover with details
- [ ] Timeline shows timestamp tooltip when hovering over empty areas
- [ ] Dragging timeline seeks smoothly
- [ ] Clicking markers seeks to exact time
- [ ] Markers grow on hover
- [ ] Tooltips don't flicker or jump
- [ ] Screenshot thumbnails load correctly
- [ ] All existing functionality still works

## Notes

- Screenshot thumbnails are cached in a Map to avoid reloading
- Uses fixed positioning for tooltips to handle scrolling properly
- Pointer events are disabled on tooltips to prevent hover conflicts
- The component preserves all existing debug logging for troubleshooting
