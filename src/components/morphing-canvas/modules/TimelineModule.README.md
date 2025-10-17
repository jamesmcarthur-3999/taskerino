# TimelineModule

A beautiful, interactive timeline component for visualizing session events with multiple display variants.

## Overview

The `TimelineModule` displays chronological events from a work session with rich visual feedback, animations, and interactive features. It supports three distinct visualization modes and can show focus periods, time markers, and real-time position indicators.

## Features

- **Three Variants**: Horizontal (default), Vertical, and Compact views
- **Event Visualization**: Distinct icons and colors for different event types
- **Focus Periods**: Visual representation of work sessions, breaks, and meetings
- **Interactive Tooltips**: Hover to see event details
- **Smooth Animations**: SVG-based timeline drawing with Framer Motion
- **Responsive Design**: Automatically adapts to mobile (vertical) and desktop (horizontal)
- **Real-time Indicator**: Shows current position in active sessions
- **Click Handlers**: Navigate to linked items (tasks, notes, etc.)

## Usage

### Basic Example

```tsx
import { TimelineModule } from './components/morphing-canvas/modules/TimelineModule';

const MyComponent = () => {
  const data = {
    sessionStart: '2024-01-01T09:00:00Z',
    sessionEnd: '2024-01-01T12:00:00Z',
    events: [
      {
        id: 'evt-1',
        type: 'task_created',
        timestamp: '2024-01-01T09:15:00Z',
        title: 'Create Feature Design',
        description: 'Draft initial design mockups'
      },
      {
        id: 'evt-2',
        type: 'screenshot_taken',
        timestamp: '2024-01-01T10:30:00Z',
        title: 'Design Mockup',
        description: 'Final design for review'
      }
    ],
    focusPeriods: [
      {
        id: 'fp-1',
        startTime: '2024-01-01T09:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        type: 'focus',
        label: 'Deep Work',
        intensity: 85
      }
    ]
  };

  return (
    <div style={{ height: '300px' }}>
      <TimelineModule
        data={data}
        variant="horizontal"
        config={{
          showDuration: true,
          showFocusPeriods: true,
          enableScrubbing: true
        }}
        onEventClick={(event) => console.log('Clicked:', event)}
      />
    </div>
  );
};
```

## Props

### `TimelineModuleProps`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | `TimelineData` | Yes | - | Timeline data including events and focus periods |
| `variant` | `'horizontal' \| 'vertical' \| 'compact'` | No | `'horizontal'` | Visual layout variant |
| `config` | `ModuleConfig` | No | `{}` | Configuration options |
| `onEventClick` | `(event: TimelineEvent) => void` | No | - | Callback when an event is clicked |
| `onTimeSeek` | `(timestamp: string) => void` | No | - | Callback when timeline is scrubbed |
| `className` | `string` | No | `''` | Additional CSS classes |

### `TimelineData`

```typescript
interface TimelineData {
  sessionStart: string;        // ISO timestamp
  sessionEnd: string;          // ISO timestamp
  events: TimelineEvent[];     // Array of timeline events
  focusPeriods?: FocusPeriod[]; // Optional focus period overlays
  currentTime?: string;         // Current position (for active sessions)
}
```

### `TimelineEvent`

```typescript
interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;           // ISO timestamp
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  linkedItemId?: string;       // ID of linked task/note
  linkedItemType?: 'task' | 'note' | 'session';
  duration?: number;           // Duration in milliseconds
  color?: string;              // Override default color
  icon?: string;               // Override default icon
}
```

### `FocusPeriod`

```typescript
interface FocusPeriod {
  id: string;
  startTime: string;           // ISO timestamp
  endTime: string;             // ISO timestamp
  type: 'focus' | 'break' | 'meeting' | 'context_switch';
  intensity?: number;          // 0-100 (for focus periods)
  label?: string;              // Display label
  color?: string;              // Custom color
}
```

### `ModuleConfig`

```typescript
interface ModuleConfig {
  showDuration?: boolean;        // Show time markers and duration
  showFocusPeriods?: boolean;    // Show focus period overlays
  enableScrubbing?: boolean;     // Allow timeline scrubbing
  enableInteraction?: boolean;   // Enable all interactions
  animationDuration?: number;    // Animation duration in ms
}
```

## Event Types

The component supports the following event types with predefined icons and colors:

| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `task_created` | CheckSquare | Blue | A new task was created |
| `task_completed` | CheckCircle2 | Green | A task was completed |
| `decision_made` | Lightbulb | Amber | An important decision was made |
| `screenshot_taken` | Camera | Violet | A screenshot was captured |
| `note_added` | FileText | Cyan | A note was added |
| `break_started` | Coffee | Orange | A break period started |
| `break_ended` | Play | Emerald | Returned from break |
| `focus_started` | Target | Pink | Entered focus mode |
| `focus_ended` | Pause | Indigo | Exited focus mode |
| `milestone_reached` | Flag | Red | A milestone was achieved |
| `context_switch` | ArrowRightLeft | Slate | Switched context/task |
| `meeting_started` | Users | Sky | A meeting started |
| `meeting_ended` | UserX | Zinc | A meeting ended |

## Variants

### Horizontal Timeline (Default)

Best for: Desktop displays, session reviews, detailed timeline browsing

- Left-to-right scrollable timeline
- Events positioned proportionally to time
- Focus periods shown as colored segments
- Time markers above timeline
- Full event details on hover

```tsx
<TimelineModule data={data} variant="horizontal" />
```

### Vertical Timeline

Best for: Mobile devices, narrow containers, chronological feeds

- Top-to-bottom scrolling
- Events grouped by proximity
- Full event cards with inline details
- Timeline connector on the left
- Responsive and touch-friendly

```tsx
<TimelineModule data={data} variant="vertical" />
```

### Compact Timeline

Best for: Dashboard widgets, overview displays, limited space

- Thin progress bar with event markers
- Minimal visual footprint (48px height)
- Focus periods as color overlays
- Detailed tooltips on hover
- Quick session overview

```tsx
<TimelineModule data={data} variant="compact" />
```

## Styling

The component uses Tailwind CSS for styling with glassmorphism design patterns:

- Background: `bg-white/40 backdrop-blur-xl`
- Border: `border-2 border-white/50`
- Rounded corners: `rounded-[24px]`
- Shadow: `shadow-lg`

You can override styles by passing a `className` prop:

```tsx
<TimelineModule
  data={data}
  className="bg-blue-100/50 border-blue-300"
/>
```

## Responsive Behavior

The component automatically adapts to screen size:

- **Desktop (≥768px)**: Uses selected variant
- **Mobile (<768px)**: Switches horizontal to vertical for better UX

You can disable this by explicitly managing the variant prop:

```tsx
const [variant, setVariant] = useState<'horizontal' | 'vertical'>('horizontal');

// Manual control - won't auto-switch
<TimelineModule data={data} variant={variant} />
```

## Animations

All animations are powered by Framer Motion:

1. **Timeline Drawing**: Timeline axis animates from left to right (or top to bottom)
2. **Event Appearance**: Events fade in and scale up sequentially
3. **Focus Periods**: Segments fade in with a slight delay
4. **Hover Effects**: Scale and shadow transitions on hover
5. **Pulse Effects**: Continuous pulse animation on event markers
6. **Tooltip**: Smooth fade and scale on show/hide

Animation timings:
- Timeline draw: 1s
- Event stagger: 50ms per event
- Hover transition: 200ms
- Tooltip: 150ms

## Accessibility

- All event markers are keyboard focusable
- ARIA labels for screen readers
- High contrast icons and colors
- Semantic HTML structure
- Focus visible indicators

## Performance

- Optimized with `useMemo` for expensive calculations
- Event grouping in vertical mode reduces DOM nodes
- CSS transforms for animations (GPU accelerated)
- Lazy tooltip rendering (only when visible)
- Efficient SVG rendering

## Integration Examples

### With Session Data

```tsx
import { useSession } from '../context/SessionContext';

const SessionTimeline = ({ sessionId }) => {
  const session = useSession(sessionId);

  const timelineData = {
    sessionStart: session.startTime,
    sessionEnd: session.endTime || new Date().toISOString(),
    events: [
      ...session.screenshots.map(ss => ({
        id: ss.id,
        type: 'screenshot_taken',
        timestamp: ss.timestamp,
        title: ss.description || 'Screenshot',
        linkedItemId: ss.id,
        linkedItemType: 'screenshot'
      })),
      ...session.tasks.map(task => ({
        id: task.id,
        type: task.done ? 'task_completed' : 'task_created',
        timestamp: task.createdAt,
        title: task.title,
        linkedItemId: task.id,
        linkedItemType: 'task'
      }))
    ],
    currentTime: session.status === 'active' ? new Date().toISOString() : undefined
  };

  return <TimelineModule data={timelineData} />;
};
```

### With Navigation

```tsx
const InteractiveTimeline = () => {
  const navigate = useNavigate();

  const handleEventClick = (event: TimelineEvent) => {
    if (event.linkedItemId && event.linkedItemType) {
      navigate(`/${event.linkedItemType}s/${event.linkedItemId}`);
    }
  };

  return (
    <TimelineModule
      data={timelineData}
      onEventClick={handleEventClick}
    />
  );
};
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+
- Chrome Android 90+

Requires support for:
- CSS Grid
- CSS Backdrop Filter
- SVG
- ES2020+ JavaScript

## File Structure

```
morphing-canvas/
├── types/
│   └── module.ts              # TypeScript type definitions
└── modules/
    ├── TimelineModule.tsx     # Main component
    ├── TimelineModule.example.tsx  # Demo/example
    └── TimelineModule.README.md    # This file
```

## Dependencies

- `react` 19.1.1+
- `framer-motion` 12.23.22+
- `lucide-react` 0.544.0+
- `tailwindcss` 3.4.17+

## License

Part of the Taskerino project.
