# TopNavigation Component - Architecture Documentation

## Overview

The TopNavigation component has been refactored into a modular, maintainable architecture following a **Component-Hook-State** pattern. This document provides a comprehensive guide to understanding, extending, and modifying the component.

---

## Table of Contents

1. [Component Hierarchy](#component-hierarchy)
2. [File Structure](#file-structure)
3. [Architecture Patterns](#architecture-patterns)
4. [How to Add Features](#how-to-add-features)
5. [Island Modes](#island-modes)
6. [Styling System](#styling-system)
7. [State Management](#state-management)
8. [Testing Guide](#testing-guide)

---

## Component Hierarchy

```
TopNavigation (index.tsx)
├── LogoContainer
│   └── Logo display with scroll fade
│
├── MenuButton
│   └── Hamburger menu (appears on scroll)
│
├── NavigationIsland (Main center component)
│   ├── TabsMode
│   │   └── TabButton (x6: capture, tasks, notes, sessions, assistant, profile)
│   │
│   ├── SearchExpandedMode
│   │   ├── SearchInput
│   │   └── SearchResults
│   │
│   └── QuickActionsMode
│       ├── QuickActionButton (x3: new task, new note, start session)
│       └── NavigationShortcuts
│
└── RightActionsBar
    ├── NotificationButton
    │   └── NotificationDropdown
    │
    ├── ReferencePanelButton
    │   └── Pinned notes count badge
    │
    ├── NedButton
    │   └── AI assistant toggle
    │
    └── ProfileButton
        └── User avatar
```

---

## File Structure

```
TopNavigation/
├── index.tsx                      # Main orchestrator component
├── README.md                      # This file
│
├── hooks/
│   ├── useIslandState.ts         # Island mode state management
│   └── useIslandState.test.ts    # Island state tests
│
├── useNavData.ts                  # Data aggregation hook
│
├── components/
│   ├── LogoContainer.tsx         # Logo with scroll animation
│   ├── MenuButton.tsx            # Hamburger menu button
│   │
│   ├── NavigationIsland.tsx      # Main island orchestrator
│   ├── TabsMode.tsx              # Default tabs view
│   ├── SearchExpandedMode.tsx    # Expanded search interface
│   ├── QuickActionsMode.tsx      # Quick actions panel
│   │
│   ├── TabButton.tsx             # Individual tab component
│   ├── SearchInput.tsx           # Search input field
│   ├── QuickActionButton.tsx     # Quick action button
│   │
│   └── RightActionsBar.tsx       # Right side action buttons
│
└── styles/
    └── buttonStyles.ts            # Shared button styling utilities
```

---

## Architecture Patterns

### 1. Component-Hook-State Pattern

Each major feature follows this pattern:

- **Component**: Pure UI rendering
- **Hook**: Business logic and state management
- **State**: Centralized in UIContext

**Example:**
```typescript
// Hook (useIslandState.ts)
export function useIslandState() {
  const [islandState, setIslandState] = useState<IslandState>('tabs');
  return { islandState, setIslandState, isExpanded: islandState !== 'tabs' };
}

// Component (NavigationIsland.tsx)
export function NavigationIsland({ islandStateHook, ... }) {
  const { islandState } = islandStateHook;
  return islandState === 'tabs' ? <TabsMode /> : <SearchExpandedMode />;
}
```

### 2. Data Aggregation Pattern

The `useNavData` hook aggregates data from multiple contexts:

```typescript
// useNavData.ts
export function useNavData() {
  const tasks = useTasks();
  const notes = useNotes();
  const sessions = useSessions();

  return {
    tabCounts: { tasks: tasks.length, notes: notes.length, ... },
    notificationData: { unread: 5, urgent: 2 },
    searchData: { recentSearches: [...], ... }
  };
}
```

### 3. Compound Component Pattern

NavigationIsland uses compound components for different modes:

```typescript
<NavigationIsland>
  {islandState === 'tabs' && <TabsMode />}
  {islandState === 'search-expanded' && <SearchExpandedMode />}
  {islandState === 'quick-actions' && <QuickActionsMode />}
</NavigationIsland>
```

---

## How to Add Features

### Adding a New Tab

**Step 1:** Update the TabType in `src/types.ts`

```typescript
export type TabType =
  | 'capture'
  | 'tasks'
  | 'notes'
  | 'sessions'
  | 'assistant'
  | 'profile'
  | 'analytics'; // New tab
```

**Step 2:** Add tab data to `TabsMode.tsx`

```typescript
const tabs = [
  // ... existing tabs
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    count: navData.tabCounts.analytics
  }
];
```

**Step 3:** Create the zone component

```typescript
// src/components/AnalyticsZone.tsx
export default function AnalyticsZone() {
  return <div>Analytics Content</div>;
}
```

**Step 4:** Add to App.tsx lazy imports and routing

```typescript
const AnalyticsZone = lazy(() => import('./components/AnalyticsZone'));

// In MainApp component:
{uiState.activeTab === 'analytics' && (
  <ErrorBoundary>
    <AnalyticsZone />
  </ErrorBoundary>
)}
```

---

### Adding a New Island Mode

**Step 1:** Update IslandState type in `useIslandState.ts`

```typescript
export type IslandState =
  | 'tabs'
  | 'search-expanded'
  | 'quick-actions'
  | 'filters-expanded'; // New mode
```

**Step 2:** Create the mode component

```typescript
// components/FiltersExpandedMode.tsx
export function FiltersExpandedMode({ onClose, navData }) {
  return (
    <div className="flex items-center gap-4 px-6">
      <button onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      {/* Filter UI */}
    </div>
  );
}
```

**Step 3:** Add to NavigationIsland.tsx

```typescript
export function NavigationIsland({ islandState, ... }) {
  return (
    <motion.div ...>
      {islandState === 'tabs' && <TabsMode ... />}
      {islandState === 'search-expanded' && <SearchExpandedMode ... />}
      {islandState === 'quick-actions' && <QuickActionsMode ... />}
      {islandState === 'filters-expanded' && <FiltersExpandedMode ... />}
    </motion.div>
  );
}
```

**Step 4:** Add trigger in your desired component

```typescript
// In TabsMode.tsx or wherever
<button onClick={() => islandStateHook.setIslandState('filters-expanded')}>
  <Filter className="w-4 h-4" />
</button>
```

---

### Adding a New Quick Action

**Step 1:** Add action data in `QuickActionsMode.tsx`

```typescript
const quickActions = [
  // ... existing actions
  {
    icon: FileSpreadsheet,
    label: 'New Report',
    shortcut: '⌘R',
    onClick: () => {
      uiDispatch({ type: 'OPEN_REPORT_MODAL' });
      onClose();
    }
  }
];
```

**Step 2:** Create the modal/action handler in UIContext

```typescript
// In UIContext reducer
case 'OPEN_REPORT_MODAL':
  return { ...state, reportModal: { isOpen: true } };
```

**Step 3:** Create the modal component

```typescript
// src/components/ReportModal.tsx
export function ReportModal() {
  const { state, dispatch } = useUI();
  // Modal implementation
}
```

---

## Island Modes

### Current Island Modes

#### 1. Tabs Mode (Default)
- **Width**: 600px
- **Content**: 6 navigation tabs
- **Activation**: Default state
- **Exit**: N/A (default mode)

#### 2. Search Expanded Mode
- **Width**: 800px
- **Content**: Search input + recent searches + results
- **Activation**: Click magnifying glass or press ⌘K
- **Exit**: Click X button or click outside (blur overlay)

#### 3. Quick Actions Mode
- **Width**: 700px
- **Content**: 3 quick action buttons + navigation shortcuts
- **Activation**: Click lightning bolt icon
- **Exit**: Click X button or click outside

### Island State Transitions

```typescript
// State machine visualization
tabs
  ├─→ search-expanded (magnifying glass click or ⌘K)
  └─→ quick-actions (lightning bolt click)

search-expanded
  └─→ tabs (X click or blur overlay click)

quick-actions
  └─→ tabs (X click or blur overlay click)
```

### Adding Custom Island Behavior

Use the `useIslandState` hook for custom island logic:

```typescript
const CustomComponent = () => {
  const islandStateHook = useIslandState();
  const { islandState, isExpanded, closeIsland, setIslandState } = islandStateHook;

  // Open island on mount
  useEffect(() => {
    setIslandState('search-expanded');
  }, []);

  // Auto-close after 5 seconds
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(closeIsland, 5000);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  return <div>Content</div>;
};
```

---

## Styling System

### Shared Button Styles

The `styles/buttonStyles.ts` module provides consistent button styling across components.

#### Available Functions:

**1. getButtonBaseStyles()**
```typescript
// Returns base button classes for all buttons
const baseClasses = getButtonBaseStyles();
// "px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
```

**2. getButtonVariant(variant, isActive?)**
```typescript
// Primary variant (default)
getButtonVariant('primary')
// "bg-cyan-500 text-white hover:bg-cyan-600"

// Secondary variant
getButtonVariant('secondary')
// "bg-gray-100 text-gray-700 hover:bg-gray-200"

// Ghost variant
getButtonVariant('ghost')
// "text-gray-600 hover:bg-gray-100"

// Active state
getButtonVariant('primary', true)
// "bg-cyan-600 text-white shadow-lg"
```

**3. getIconButtonStyles()**
```typescript
// Compact icon-only button styles
const iconStyles = getIconButtonStyles();
// "p-2 rounded-full hover:bg-gray-100 transition-colors"
```

#### Usage Example:

```typescript
import { getButtonBaseStyles, getButtonVariant } from '../styles/buttonStyles';

export function CustomButton({ isActive }) {
  return (
    <button className={`${getButtonBaseStyles()} ${getButtonVariant('primary', isActive)}`}>
      Click Me
    </button>
  );
}
```

### Custom Component Styles

For component-specific styling, define styles in the component file:

```typescript
// TabButton.tsx
const tabButtonStyles = {
  base: 'relative px-4 py-2 rounded-lg font-medium transition-all duration-200',
  active: 'bg-white shadow-sm text-cyan-600',
  inactive: 'text-gray-600 hover:text-gray-900 hover:bg-white/50',
};

<button className={`${tabButtonStyles.base} ${isActive ? tabButtonStyles.active : tabButtonStyles.inactive}`}>
```

### Animation Patterns

We use Framer Motion for animations:

```typescript
import { motion } from 'framer-motion';

// Island width animation
<motion.div
  animate={{ width: isExpanded ? 800 : 600 }}
  transition={{ duration: 0.3, ease: 'easeInOut' }}
>

// Fade in/out
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>

// Slide in
<motion.div
  initial={{ x: -20, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ delay: 0.1 }}
>
```

---

## State Management

### UIContext Integration

The TopNavigation component primarily uses UIContext for state:

```typescript
const { state: uiState, dispatch: uiDispatch } = useUI();

// Reading state
const activeTab = uiState.activeTab;
const notifications = uiState.notifications;
const pinnedNotes = uiState.pinnedNotes;

// Dispatching actions
uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
uiDispatch({ type: 'TOGGLE_REFERENCE_PANEL' });
uiDispatch({ type: 'TOGGLE_COMMAND_PALETTE' });
```

### Local State

Component-specific UI state is kept local:

```typescript
// TopNavigation/index.tsx
const [hoveredTab, setHoveredTab] = useState<TabType | null>(null);
const [showNotifications, setShowNotifications] = useState(false);
const [showReferencePanelTooltip, setShowReferencePanelTooltip] = useState(false);
```

### Custom Hooks

Extract reusable logic into custom hooks:

```typescript
// hooks/useNotificationBadge.ts
export function useNotificationBadge() {
  const { state } = useUI();

  const unreadCount = state.notifications.filter(n => !n.read).length;
  const hasUrgent = state.notifications.some(n => n.priority === 'urgent' && !n.read);

  return { unreadCount, hasUrgent, showBadge: unreadCount > 0 };
}

// Usage in component
const { unreadCount, hasUrgent, showBadge } = useNotificationBadge();
```

---

## Testing Guide

### Running Tests

```bash
# Run all TopNavigation tests
npm test -- TopNavigation

# Run specific test file
npm test -- useIslandState.test.ts

# Watch mode
npm test -- --watch TopNavigation
```

### Test Structure

Tests are colocated with their modules:

```
TopNavigation/
├── hooks/
│   ├── useIslandState.ts
│   └── useIslandState.test.ts
├── components/
│   ├── TabButton.tsx
│   └── TabButton.test.tsx
```

### Writing Component Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TabButton } from './TabButton';

describe('TabButton', () => {
  it('renders with label and icon', () => {
    render(
      <TabButton
        id="tasks"
        label="Tasks"
        icon={CheckSquare}
        isActive={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<TabButton id="tasks" label="Tasks" onClick={handleClick} />);

    fireEvent.click(screen.getByText('Tasks'));
    expect(handleClick).toHaveBeenCalledWith('tasks');
  });
});
```

### Writing Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useIslandState } from './useIslandState';

describe('useIslandState', () => {
  it('starts in tabs mode', () => {
    const { result } = renderHook(() => useIslandState());
    expect(result.current.islandState).toBe('tabs');
    expect(result.current.isExpanded).toBe(false);
  });

  it('expands when setting non-tabs state', () => {
    const { result } = renderHook(() => useIslandState());

    act(() => {
      result.current.setIslandState('search-expanded');
    });

    expect(result.current.islandState).toBe('search-expanded');
    expect(result.current.isExpanded).toBe(true);
  });
});
```

---

## Best Practices

### 1. Component Organization

- **One component per file**: Each component should have its own file
- **Colocate tests**: Keep test files next to their modules
- **Group related components**: Use folders for component families

### 2. Naming Conventions

- **Components**: PascalCase (e.g., `TabButton`, `SearchInput`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useIslandState`, `useNavData`)
- **Types**: PascalCase (e.g., `IslandState`, `TabType`)
- **Files**: Match the export name (e.g., `TabButton.tsx` exports `TabButton`)

### 3. Props Pattern

Use explicit prop types:

```typescript
interface TabButtonProps {
  id: TabType;
  label: string;
  icon: LucideIcon;
  count?: number;
  isActive: boolean;
  onClick: (id: TabType) => void;
}

export function TabButton({ id, label, icon, count, isActive, onClick }: TabButtonProps) {
  // ...
}
```

### 4. Performance Optimization

- **Use React.memo** for components that receive stable props
- **Memoize callbacks** with useCallback when passing to child components
- **Memoize expensive computations** with useMemo
- **Lazy load** heavy components

```typescript
import { memo, useCallback, useMemo } from 'react';

export const TabButton = memo(function TabButton({ id, label, onClick }) {
  const handleClick = useCallback(() => {
    onClick(id);
  }, [id, onClick]);

  return <button onClick={handleClick}>{label}</button>;
});
```

### 5. Accessibility

- **Keyboard navigation**: Support Tab, Enter, Escape
- **ARIA labels**: Add descriptive labels for screen readers
- **Focus management**: Manage focus when opening/closing islands
- **Semantic HTML**: Use appropriate HTML elements

```typescript
<button
  onClick={handleClick}
  aria-label="Open notifications"
  aria-expanded={isOpen}
  aria-haspopup="true"
>
  <Bell className="w-5 h-5" />
  {unreadCount > 0 && (
    <span className="sr-only">{unreadCount} unread notifications</span>
  )}
</button>
```

---

## Migration Notes

### From Monolithic to Modular

The original `TopNavigation.tsx` (73KB, 2000+ lines) has been split into:

- **1 orchestrator** (index.tsx)
- **12+ focused components** (each <200 lines)
- **2 custom hooks** (business logic)
- **1 data hook** (data aggregation)
- **1 styles module** (shared styles)

### Breaking Changes

None! The refactor maintains 100% API compatibility with the rest of the application. The import path remains the same:

```typescript
import { TopNavigation } from './components/TopNavigation';
```

### Rollback Procedure

If issues arise, the original component is backed up:

```bash
# Restore original
mv src/components/TopNavigation.tsx.backup src/components/TopNavigation.tsx

# Remove modular version
rm -rf src/components/TopNavigation/
```

---

## Future Enhancements

### Planned Features

1. **Smart Search**: AI-powered search with semantic matching
2. **Command Palette Integration**: Full ⌘K interface in island
3. **Custom Island Modes**: User-defined island configurations
4. **Keyboard Shortcuts Panel**: Interactive shortcuts guide
5. **Theming System**: Support for dark mode and custom themes

### Extension Points

The architecture supports easy extension:

- **New island modes**: Add to IslandState type + create component
- **New tabs**: Update TabType + add zone component
- **New quick actions**: Add to quickActions array in QuickActionsMode
- **Custom hooks**: Extract any reusable logic
- **Shared utilities**: Add to styles/ directory

---

## Support

For questions or issues related to TopNavigation:

1. Check this README
2. Review the component source code (well-commented)
3. Run tests to verify behavior
4. Check git history for context on changes

---

**Last Updated**: Phase 7 - Component Replacement
**Version**: 2.0.0 (Modular Architecture)
