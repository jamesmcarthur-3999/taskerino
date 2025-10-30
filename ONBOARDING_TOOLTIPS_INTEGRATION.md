# OnboardingTooltips Integration Guide

## Overview

The `OnboardingTooltips` component provides organic, contextual guidance for new users. It uses the existing `FeatureTooltip` component with smart trigger logic based on `UIContext` tracking.

## File Location

`src/components/OnboardingTooltips.tsx`

## Configured Tooltips

### 1. Capture Box Introduction
- **Trigger**: First time user focuses on capture input
- **Position**: bottom
- **Content**: "Type anything here - tasks, notes, ideas. AI will automatically organize and categorize everything for you."
- **Auto-dismiss**: 8 seconds
- **Feature flag**: `captureBox`

### 2. Sessions Introduction
- **Trigger**: User hovers Sessions tab for first time
- **Position**: bottom-right
- **Content**: "Sessions record screenshots and audio of your work, then generate AI-powered summaries and insights to help you review what you accomplished."
- **Auto-dismiss**: 10 seconds
- **Feature flag**: `sessions`

### 3. Keyboard Shortcuts
- **Trigger**: After user's first successful capture
- **Position**: top
- **Content**: Shows key shortcuts (⌘+Enter, ⌘+K, ⌘+/)
- **Auto-dismiss**: 6 seconds
- **Feature flag**: `cmdK`

## Integration Examples

### Example 1: CaptureZone Integration

```tsx
import { CaptureBoxTooltip, KeyboardShortcutsTooltip, useTooltipTriggers } from './OnboardingTooltips';

export function CaptureZone() {
  const [isFocused, setIsFocused] = useState(false);
  const { markFirstCaptureComplete } = useTooltipTriggers();

  const handleCapture = async (text: string) => {
    // ... process capture logic ...

    // After successful capture, mark first capture complete
    markFirstCaptureComplete();
  };

  return (
    <div className="capture-zone">
      {/* Capture Input with tooltip */}
      <div className="relative">
        <input
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What's on your mind?"
        />

        {/* Show capture box tooltip on first focus */}
        <CaptureBoxTooltip isCaptureInputFocused={isFocused} />
      </div>

      {/* Show keyboard shortcuts tooltip after first capture */}
      <KeyboardShortcutsTooltip />
    </div>
  );
}
```

### Example 2: SessionsZone Integration

```tsx
import { SessionsTooltip } from './OnboardingTooltips';

export function TopNavigation() {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  return (
    <nav>
      <div
        className="relative"
        onMouseEnter={() => setHoveredTab('sessions')}
        onMouseLeave={() => setHoveredTab(null)}
      >
        <button>Sessions</button>

        {/* Show sessions tooltip on first hover */}
        <SessionsTooltip isSessionsTabHovered={hoveredTab === 'sessions'} />
      </div>
    </nav>
  );
}
```

### Example 3: Using All Tooltips Together

```tsx
import { AllOnboardingTooltips } from './OnboardingTooltips';

export function MyZone() {
  const [captureInputFocused, setCaptureInputFocused] = useState(false);
  const [sessionsTabHovered, setSessionsTabHovered] = useState(false);

  return (
    <div>
      {/* Your zone content */}

      {/* All tooltips in one place */}
      <AllOnboardingTooltips
        captureInputFocused={captureInputFocused}
        sessionsTabHovered={sessionsTabHovered}
      />
    </div>
  );
}
```

### Example 4: Using the Hook for Custom Logic

```tsx
import { useTooltipTriggers } from './OnboardingTooltips';

export function CustomComponent() {
  const { markFirstCaptureComplete, shouldShowTooltip, firstCaptureCompleted } = useTooltipTriggers();

  const handleSubmit = () => {
    // ... your logic ...

    // Mark first capture as complete
    markFirstCaptureComplete();
  };

  // Check if a specific tooltip should show
  const showCaptureTooltip = shouldShowTooltip('captureBox');

  return (
    <div>
      {showCaptureTooltip && <p>This is the user's first time!</p>}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

## Available Components

### Individual Tooltip Components

1. **CaptureBoxTooltip**
   ```tsx
   <CaptureBoxTooltip isCaptureInputFocused={boolean} />
   ```

2. **SessionsTooltip**
   ```tsx
   <SessionsTooltip isSessionsTabHovered={boolean} />
   ```

3. **KeyboardShortcutsTooltip**
   ```tsx
   <KeyboardShortcutsTooltip hasCompletedFirstCapture={boolean} />
   ```

### Composite Component

**AllOnboardingTooltips**
```tsx
<AllOnboardingTooltips
  captureInputFocused={boolean}
  sessionsTabHovered={boolean}
  firstCaptureCompleted={boolean}
/>
```

### Hook

**useTooltipTriggers()**
```tsx
const {
  markFirstCaptureComplete,    // Function to mark first capture complete
  shouldShowTooltip,            // Function to check if tooltip should show
  firstCaptureCompleted         // Boolean state
} = useTooltipTriggers();
```

## Trigger Logic

Each tooltip uses smart trigger logic:

1. **Check Feature Introduction**: Ensures tooltip hasn't been shown before
2. **Check Dismissal State**: Respects user dismissals
3. **Check Trigger Condition**: External condition (focus, hover, etc.)
4. **Auto-Dismiss**: Automatically dismisses after configured delay
5. **Mark as Introduced**: Prevents re-showing the same tooltip

### State Flow

```
User Action (focus/hover/capture)
  ↓
Trigger Condition = true
  ↓
Check UIContext:
  - featureIntroductions[feature] = false?
  - dismissedTooltips.includes(id) = false?
  ↓
Show Tooltip
  ↓
Dispatch MARK_FEATURE_INTRODUCED
  ↓
Auto-dismiss after delay OR user dismisses
  ↓
Dispatch DISMISS_TOOLTIP
  ↓
Never show again
```

## UIContext Integration

The component integrates with `UIContext` onboarding state:

### State Structure
```typescript
onboarding: {
  featureIntroductions: {
    captureBox: boolean;      // Capture Box tooltip shown
    sessions: boolean;         // Sessions tooltip shown
    cmdK: boolean;            // Keyboard shortcuts tooltip shown
  },
  dismissedTooltips: string[]; // IDs of manually dismissed tooltips
  firstCaptureCompleted: boolean;
  stats: {
    tooltipsShown: number;
    tooltipsDismissed: number;
  }
}
```

### Actions Used
- `MARK_FEATURE_INTRODUCED` - Mark feature as introduced
- `DISMISS_TOOLTIP` - Add tooltip ID to dismissed list
- `INCREMENT_TOOLTIP_STAT` - Track shown/dismissed counts
- `COMPLETE_FIRST_CAPTURE` - Mark first capture complete
- `INCREMENT_ONBOARDING_STAT` - Increment capture count

## Customization

### Adding a New Tooltip

1. Add tooltip ID to `TOOLTIP_IDS`:
   ```tsx
   const TOOLTIP_IDS = {
     MY_NEW_TOOLTIP: 'my-new-tooltip-intro',
   };
   ```

2. Add configuration to `TOOLTIP_CONFIGS`:
   ```tsx
   myNewFeature: {
     id: TOOLTIP_IDS.MY_NEW_TOOLTIP,
     featureFlag: 'myNewFeature',
     position: 'bottom',
     title: 'My New Feature',
     message: 'This is what my new feature does.',
     autoDismissDelay: 8000,
     delay: 500,
   }
   ```

3. Add feature flag to OnboardingState in types.ts:
   ```tsx
   featureIntroductions: {
     // ... existing flags ...
     myNewFeature: boolean;
   }
   ```

4. Create component:
   ```tsx
   export function MyNewFeatureTooltip({ isTriggered }: { isTriggered: boolean }) {
     return (
       <TooltipTrigger
         tooltipKey="myNewFeature"
         triggerCondition={isTriggered}
       />
     );
   }
   ```

## Best Practices

1. **Non-Intrusive**: Tooltips auto-dismiss and never block user actions
2. **Respect User Preferences**: Once dismissed, never show again
3. **Clear Triggers**: Only show when user interacts with related feature
4. **Concise Content**: Keep messages brief (1-2 sentences max)
5. **Value-Focused**: Explain benefits, not just features
6. **Lightweight**: All components are lazy-loaded and efficient

## Testing

To test tooltips in development:

1. **Reset Onboarding State**:
   ```tsx
   const { dispatch } = useUI();
   dispatch({ type: 'RESET_ONBOARDING' });
   ```

2. **Check Current State**:
   ```tsx
   const { state } = useUI();
   console.log(state.onboarding.featureIntroductions);
   console.log(state.onboarding.dismissedTooltips);
   ```

3. **Manually Trigger**:
   ```tsx
   // Set up trigger conditions in parent component
   const [isFocused, setIsFocused] = useState(true); // Force trigger
   ```

## TypeScript Support

All components are fully typed with TypeScript:

```tsx
interface CaptureBoxTooltipProps {
  isCaptureInputFocused: boolean;
}

interface SessionsTooltipProps {
  isSessionsTabHovered: boolean;
}

interface KeyboardShortcutsTooltipProps {
  hasCompletedFirstCapture?: boolean;
}
```

## Performance Considerations

- **Minimal Re-renders**: Uses `useCallback` and `useState` strategically
- **Lightweight**: No heavy dependencies, uses existing FeatureTooltip
- **Auto-Cleanup**: Properly cleans up effects and event listeners
- **Smart Checks**: Bails early if conditions aren't met

## Accessibility

The tooltips inherit accessibility features from `FeatureTooltip`:
- Keyboard dismissible (Escape key)
- Screen reader compatible
- Focus management
- ARIA labels

## Future Enhancements

Potential improvements for future phases:

1. **Analytics**: Track tooltip effectiveness
2. **A/B Testing**: Test different messages/timings
3. **Dynamic Content**: Personalize based on user behavior
4. **Progressive Disclosure**: Chain tooltips in sequences
5. **Contextual Help**: Link to detailed documentation

## Troubleshooting

### Tooltip Not Showing

1. Check `featureIntroductions[feature]` is `false`
2. Check `dismissedTooltips` doesn't include tooltip ID
3. Verify trigger condition is `true`
4. Check UIProvider is wrapping component
5. Look for console errors in TypeScript

### Tooltip Shows Every Time

1. Ensure `MARK_FEATURE_INTRODUCED` is dispatched
2. Verify UIContext persistence is working
3. Check storage is saving properly (5-second debounce)

### Styling Issues

1. Ensure FeatureTooltip CSS is loaded
2. Check z-index conflicts
3. Verify parent has `position: relative` if needed
4. Check tooltip position setting matches layout

## Related Files

- `src/components/FeatureTooltip.tsx` - Base tooltip component
- `src/context/UIContext.tsx` - Onboarding state management
- `src/types.ts` - OnboardingState type definitions
- `src/design-system/theme.ts` - Design tokens and styles
