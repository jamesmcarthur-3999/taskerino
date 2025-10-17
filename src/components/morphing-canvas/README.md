# Morphing Canvas System

A powerful, flexible, and animated canvas system for building dynamic dashboard layouts with smooth morphing transitions.

## Features

- **Responsive Grid Layouts**: CSS Grid-based layouts with responsive breakpoints
- **Module System**: Pluggable module architecture with registry
- **Smooth Animations**: Framer Motion-powered layout transitions and FLIP animations
- **Theme Support**: Light/dark themes with customizable color palettes
- **Accessibility**: Respects `prefers-reduced-motion` for accessible animations
- **TypeScript**: Full type safety with comprehensive type definitions
- **Error Boundaries**: Graceful error handling with fallback UIs
- **Layout Templates**: Pre-configured layouts with easy switching

## Quick Start

### 1. Initialize the Module Registry

```tsx
import { initializeModuleRegistry } from './components/morphing-canvas';

// In your app initialization
initializeModuleRegistry();
```

### 2. Create a Configuration

```tsx
import { MorphingCanvasConfig } from './components/morphing-canvas';
import { dashboardLayout } from './components/morphing-canvas/layouts/defaultLayouts';

const config: MorphingCanvasConfig = {
  id: 'my-canvas',
  name: 'My Dashboard',
  layout: dashboardLayout,
  theme: {
    mode: 'light',
    // ... theme configuration
  },
  modules: [
    {
      id: 'clock-1',
      type: 'clock',
      slotId: 'clock',
      enabled: true,
    },
    // ... more modules
  ],
};
```

### 3. Render the Canvas

```tsx
import { MorphingCanvas } from './components/morphing-canvas';

function App() {
  return (
    <MorphingCanvas
      config={config}
      onAction={(action) => console.log('Action:', action)}
      onLayoutChange={(layoutId) => console.log('Layout:', layoutId)}
    />
  );
}
```

## Architecture

### Components

- **MorphingCanvas**: Main container component that renders the entire canvas
- **ModuleRenderer**: Renders individual modules with chrome, animations, and error handling
- **Module Components**: Individual feature modules (Clock, Notes, QuickActions, etc.)

### Key Concepts

#### Layouts

Layouts define the grid structure and module placement:

```tsx
interface LayoutTemplate {
  id: string;
  name: string;
  slots: Record<string, ResponsiveGridSlot>;
  gridConfig: {
    columns: number;
    gap: string;
  };
}
```

#### Modules

Modules are pluggable components that render in layout slots:

```tsx
interface ModuleConfig {
  id: string;
  type: ModuleType;
  slotId: string; // References a slot in the layout
  enabled?: boolean;
  settings?: Record<string, unknown>;
  chrome?: {
    showHeader?: boolean;
    title?: string;
    actions?: ModuleChromeAction[];
  };
}
```

#### Module Registry

The registry maps module types to components:

```tsx
registerModule({
  type: 'clock',
  component: ClockModule,
  displayName: 'Clock',
  defaultConfig: {
    // ... default configuration
  },
});
```

## Built-in Modules

### Clock Module

Displays current time and date with formatting options.

```tsx
{
  id: 'clock-1',
  type: 'clock',
  slotId: 'clock',
  settings: {
    format24h: false,
    showSeconds: true,
    showDate: true,
  },
}
```

### Quick Actions Module

Grid of customizable action buttons.

```tsx
{
  id: 'actions-1',
  type: 'quick-actions',
  slotId: 'actions',
  settings: {
    columns: 2,
    actions: [
      {
        id: 'new-task',
        label: 'New Task',
        icon: 'plus',
        color: 'blue',
        action: 'create-task',
      },
    ],
  },
}
```

### Notes Module

Simple note-taking interface with list view.

```tsx
{
  id: 'notes-1',
  type: 'notes',
  slotId: 'notes',
}
```

## Creating Custom Modules

### 1. Define the Component

```tsx
import type { ModuleProps } from './types';

interface MyModuleData {
  items: string[];
}

export function MyCustomModule({ config, data, onAction }: ModuleProps<MyModuleData>) {
  return (
    <div className="p-4">
      <h3>{config.chrome?.title || 'My Module'}</h3>
      {/* Your module UI */}
    </div>
  );
}
```

### 2. Register the Module

```tsx
import { registerModule } from './registry';

registerModule({
  type: 'custom',
  component: MyCustomModule,
  displayName: 'My Custom Module',
  description: 'Custom module example',
  defaultConfig: {
    id: '',
    type: 'custom',
    slotId: '',
  },
});
```

### 3. Add to Configuration

```tsx
{
  id: 'my-module-1',
  type: 'custom',
  slotId: 'main-content',
  enabled: true,
}
```

## Animations

The system includes powerful animation utilities:

### Pre-configured Variants

```tsx
import {
  fadeInVariants,
  slideUpVariants,
  scaleUpVariants,
  bounceInVariants,
} from './animations/transitions';
```

### FLIP Animations

```tsx
import { performFLIPTransition } from './animations/transitions';

await performFLIPTransition(element, () => {
  // Make layout change
});
```

### Stagger Animations

```tsx
import { createStaggerVariants } from './animations/transitions';

const variants = createStaggerVariants({
  staggerChildren: 0.1,
  delayChildren: 0.2,
});
```

### Reduced Motion

```tsx
import { useReducedMotion } from './animations/transitions';

const reducedMotion = useReducedMotion();
// Automatically respects user's motion preferences
```

## Layout Templates

Built-in layout templates:

- **Dashboard**: Balanced grid with clock, actions, and notes
- **Focus**: Large content area with minimal sidebar
- **Compact**: Three-column layout for maximum density
- **Zen**: Minimal centered layout for distraction-free focus

## Theme System

Customizable themes with light/dark mode support:

```tsx
const theme: ThemeConfig = {
  mode: 'light',
  colors: {
    primary: '#3b82f6',
    background: '#ffffff',
    text: '#111827',
    // ... more colors
  },
  borderRadius: {
    small: '0.5rem',
    medium: '1rem',
    large: '1.5rem',
  },
  typography: {
    fontFamily: 'sans-serif',
    fontSize: {
      base: '1rem',
      // ... more sizes
    },
  },
};
```

## API Reference

### MorphingCanvas Props

| Prop | Type | Description |
|------|------|-------------|
| `config` | `MorphingCanvasConfig` | Canvas configuration |
| `sessionData` | `SessionData?` | Optional session data passed to modules |
| `onAction` | `(action: ModuleAction) => void?` | Module action handler |
| `onLayoutChange` | `(layoutId: string) => void?` | Layout change handler |
| `className` | `string?` | Additional CSS classes |

### ModuleRenderer Props

| Prop | Type | Description |
|------|------|-------------|
| `config` | `ModuleConfig` | Module configuration |
| `sessionData` | `SessionData?` | Optional session data |
| `onAction` | `(action: ModuleAction) => void?` | Action handler |
| `data` | `unknown?` | Module-specific data |
| `className` | `string?` | Additional CSS classes |

## Best Practices

1. **Initialize Registry Once**: Call `initializeModuleRegistry()` at app startup
2. **Use Layout Slots**: Define clear, semantic slot names in your layouts
3. **Module Isolation**: Keep modules self-contained and data-driven
4. **Respect Reduced Motion**: Always enable `respectReducedMotion` in config
5. **Error Handling**: Use try-catch in module components for graceful degradation
6. **Type Safety**: Use TypeScript types for module data and settings

## Examples

See `example.tsx` for complete working examples including:

- Basic usage
- Custom session data
- Dynamic configuration updates
- Custom module creation

## Performance Tips

1. Use `layout` prop on motion components for optimized animations
2. Enable module preloading for critical modules
3. Use `priority` field to control loading order
4. Disable animations for non-visible modules
5. Use React.memo for expensive module components

## Tech Stack

- React + TypeScript
- Framer Motion (animations)
- @dnd-kit (drag and drop)
- Recharts (charts/analytics)
- Shiki (code syntax highlighting)
- React Player (media playback)
- Yet Another React Lightbox (media viewing)
- Tailwind CSS + shadcn/ui

## Status

**Implementation Complete** - All core components, animations, modules, layouts, and configurations are implemented and ready to use.
