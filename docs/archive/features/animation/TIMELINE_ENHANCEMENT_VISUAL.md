# Timeline Enhancement Visual Guide

## Component Structure

```
UnifiedTimeline Component
│
├── State Management
│   ├── isDragging: boolean (tracks drag state)
│   ├── previewTime: number | null (hover position time)
│   ├── hoverPosition: {x, y} | null (mouse coordinates)
│   ├── hoveredScreenshot: SessionScreenshot | null
│   ├── hoveredMoment: AudioKeyMoment | null
│   └── screenshotThumbnails: Map<string, string> (cache)
│
├── TimelineTooltip Component (new)
│   └── Fixed position tooltip following mouse
│
└── Timeline Visual Elements
    ├── Key Moment Markers Row
    │   ├── Interactive dots (grow on hover: 2px → 3px)
    │   ├── onMouseEnter → load tooltip
    │   ├── onMouseLeave → hide tooltip
    │   └── onClick → seek to moment
    │
    ├── Slider Track (main timeline)
    │   ├── onMouseDown → start dragging
    │   ├── onMouseMove → update preview / seek if dragging
    │   ├── onMouseLeave → reset hover state
    │   │
    │   ├── Progress Fill (cyan-blue gradient)
    │   │
    │   ├── Preview Line (shown on hover, not while dragging)
    │   │
    │   ├── Screenshot Markers
    │   │   ├── Interactive dots (grow on hover: 1.5px → 3px)
    │   │   ├── onMouseEnter → load tooltip with thumbnail
    │   │   ├── onMouseLeave → hide tooltip
    │   │   └── onClick → seek to screenshot time
    │   │
    │   └── Playhead (animated circle following currentTime)
    │
    └── Tooltips (conditionally rendered)
        ├── Screenshot Tooltip
        │   ├── Timestamp
        │   ├── Thumbnail image (48px wide, auto height)
        │   ├── AI Summary (if available)
        │   └── "Click to seek" hint
        │
        ├── Key Moment Tooltip
        │   ├── Timestamp
        │   ├── Type badge (colored border)
        │   ├── Label/Title
        │   ├── Excerpt (if available)
        │   └── "Click to seek" hint
        │
        └── Preview Tooltip (fallback when not hovering a marker)
            └── Timestamp only
```

## Interaction Flow

### Scenario 1: Hovering over Screenshot Marker
```
User hovers over screenshot marker
↓
onMouseEnter fires
↓
hoveredScreenshot state updated
↓
hoverPosition state updated (mouse x, y coordinates)
↓
useEffect detects hoveredScreenshot change
↓
Loads screenshot from attachmentStorage (if not cached)
↓
Adds to screenshotThumbnails Map
↓
TimelineTooltip renders at hover position with:
  - Timestamp
  - Thumbnail image
  - AI summary
  - Click hint
↓
Marker grows from 1.5px to 3px (CSS transition)
↓
User moves mouse away
↓
onMouseLeave fires
↓
hoveredScreenshot set to null
↓
Tooltip disappears
↓
Marker shrinks back to 1.5px
```

### Scenario 2: Dragging Timeline
```
User clicks on timeline
↓
onMouseDown fires
↓
isDragging set to true
↓
Time calculated from mouse position
↓
onSeek(time) called
↓
User moves mouse (still holding button)
↓
onMouseMove fires continuously
↓
Preview time updated
↓
isDragging is true, so onSeek(time) called each frame
↓
Media seeks smoothly
↓
User releases mouse button
↓
Global mouseup handler fires
↓
isDragging set to false
↓
Normal hover mode resumes
```

### Scenario 3: Clicking Key Moment Marker
```
User hovers over key moment marker
↓
Tooltip appears with moment details
↓
Marker grows from 2px to 3px
↓
User clicks marker
↓
onClick handler fires
↓
onSeek(moment.timestamp) called
↓
Media jumps to exact moment time
↓
Playhead animates to new position
↓
Transcript scrolls to active segment (if audio present)
```

## CSS Classes & Styling

### Tooltip Styling
```
fixed z-50 pointer-events-none
- Fixed positioning (not affected by scroll)
- z-50 ensures always on top
- pointer-events-none prevents hover conflicts

bg-gray-900/95 backdrop-blur-md
- Semi-transparent dark background
- Backdrop blur for glassmorphism effect

px-3 py-2 rounded-lg shadow-2xl border border-white/20
- Padding for content
- Rounded corners
- Strong shadow for depth
- Subtle white border
```

### Marker Styling (Hover States)
```css
/* Screenshot Marker Default */
w-1.5 h-1.5 bg-blue-400 rounded-full shadow-sm cursor-pointer transition-all z-10

/* Screenshot Marker Hovered */
w-3 h-3 bg-blue-400 rounded-full shadow-sm cursor-pointer transition-all z-10

/* Key Moment Marker Default */
w-2 h-2 bg-[color]-500 rounded-full shadow-md cursor-pointer transition-all

/* Key Moment Marker Hovered */
w-3 h-3 bg-[color]-500 rounded-full shadow-md cursor-pointer transition-all
```

### Preview Line
```css
absolute inset-y-0 w-0.5 bg-white/60 pointer-events-none z-10
- Vertical line spanning full height
- 0.5px width (2px actual)
- Semi-transparent white
- Positioned at hover time
```

## Performance Optimizations

1. **Thumbnail Caching**: Screenshots loaded once, stored in Map
2. **Conditional Rendering**: Tooltips only render when hovering
3. **Throttled Events**: Mouse move handlers are efficient
4. **will-change**: CSS property for smooth animations on playhead/progress
5. **Lazy Loading**: Thumbnails only load on hover, not on mount

## Visual Hierarchy (Z-Index Layers)

```
Layer 50: Tooltips (fixed, always on top)
Layer 20: Playhead (must be above everything on timeline)
Layer 10: Markers & Preview Line
Layer 0:  Timeline track & progress fill
```

## Color Coding

### Key Moment Types
- Achievement: Green (#10b981 - green-500)
- Blocker: Red (#ef4444 - red-500)
- Decision: Purple (#a855f7 - purple-500)
- Insight: Blue (#3b82f6 - blue-500)
- Default: Amber (#f59e0b - amber-500)

### Timeline Elements
- Progress Fill: Cyan to Blue gradient (#06b6d4 to #3b82f6)
- Screenshot Markers: Light Blue (#60a5fa - blue-400)
- Playhead: White with Cyan border
- Preview Line: Semi-transparent White
- Tooltips: Dark gray background (#111827/95 - gray-900)
