# Design System Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate and standardize Taskerino's UI design system by fixing z-index conflicts, unifying animation systems, enforcing design token usage, and eliminating magic numbers across 70+ components.

**Architecture:** This refactor follows an inside-out approach: first fix the design system core (theme.ts, animation tokens), then update all consuming components in batches organized by feature area. Breaking changes to component APIs are acceptable.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Framer Motion, Vite

---

## Overview

This plan addresses four critical issues discovered during UI audit:

1. **Z-Index Chaos**: Two competing `Z_INDEX` definitions, 30+ files with hardcoded arbitrary z-index values
2. **Animation Fragmentation**: Three separate animation systems (`@/animations`, `@/lib/animations`, inline configs)
3. **Glass Morphism Inconsistency**: 72+ files bypass `getGlassClasses()` with hardcoded patterns
4. **Magic Numbers**: Hundreds of hardcoded values for spacing, timing, dimensions

**Estimated scope**: ~15 tasks, touching ~100 files

---

## Phase 1: Foundation (Design System Core)

### Task 1: Consolidate Z-Index System

**Files:**
- Modify: `src/design-system/theme.ts:872-878`
- Delete content in: `src/components/TopNavigation/constants.ts:66-70`
- Modify: `src/animations/tokens.ts:377-392`

**Step 1: Update Z_INDEX in theme.ts**

Replace the current Z_INDEX export with a properly ordered hierarchy:

```typescript
/**
 * Z-Index Hierarchy
 *
 * Semantic layering system. Higher = closer to user.
 * All components MUST use these tokens - no hardcoded z-index values.
 */
export const Z_INDEX = {
  // Base layer - default stacking context
  base: 'z-0',

  // Content layer - cards, badges, minor elevations
  content: 'z-10',

  // Sticky layer - sticky headers, floating elements within scroll
  sticky: 'z-20',

  // Dropdown layer - menus, selects, popovers
  dropdown: 'z-30',

  // Overlay layer - sidebars, panels, overlays that dim content
  overlay: 'z-40',

  // Modal layer - dialogs, modals, confirmation dialogs
  modal: 'z-50',

  // Toast layer - notifications, toasts, banners
  toast: 'z-60',

  // Tooltip layer - tooltips, hover cards
  tooltip: 'z-70',

  // Maximum layer - critical system UI (loading screens, welcome flow)
  maximum: 'z-[100]',
} as const;

export type ZIndexLevel = keyof typeof Z_INDEX;

/**
 * Get numeric z-index value for inline styles
 */
export function getZIndexValue(level: ZIndexLevel): number {
  const values: Record<ZIndexLevel, number> = {
    base: 0,
    content: 10,
    sticky: 20,
    dropdown: 30,
    overlay: 40,
    modal: 50,
    toast: 60,
    tooltip: 70,
    maximum: 100,
  };
  return values[level];
}
```

**Step 2: Remove duplicate Z_INDEX from TopNavigation/constants.ts**

Delete lines 66-70 in `src/components/TopNavigation/constants.ts`:

```typescript
// DELETE THIS BLOCK:
export const Z_INDEX = {
  overlay: 30,
  navigation: 50,
  dropdown: 9999,
}
```

**Step 3: Remove duplicate zIndices from animations/tokens.ts**

Delete lines 377-392 in `src/animations/tokens.ts`:

```typescript
// DELETE THIS BLOCK:
export const zIndices = {
  base: 0,
  elevated: 10,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
} as const;
```

**Step 4: Verify build passes**

Run: `npm run type-check`
Expected: No new TypeScript errors

**Step 5: Commit**

```bash
git add src/design-system/theme.ts src/components/TopNavigation/constants.ts src/animations/tokens.ts
git commit -m "$(cat <<'EOF'
fix(design-system): consolidate z-index into single hierarchy

- Replace chaotic z-index values (z-[9999], z-50, z-[10001]) with semantic levels
- Remove duplicate Z_INDEX from TopNavigation/constants.ts
- Remove duplicate zIndices from animations/tokens.ts
- Add getZIndexValue() helper for inline style usage

BREAKING CHANGE: Z_INDEX tokens renamed. Components using old tokens must update.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Consolidate Animation System

**Files:**
- Modify: `src/animations/tokens.ts`
- Modify: `src/animations/index.ts`
- Deprecate: `src/lib/animations/presets.ts`
- Modify: `src/lib/animations/index.ts`

**Step 1: Ensure animations/tokens.ts has all required exports**

Verify `src/animations/tokens.ts` exports these (add if missing):

```typescript
// Re-export accessibility utilities from lib/animations (they're unique there)
export { useReducedMotion, shouldReduceMotion, getMotionSafeVariant } from '../lib/animations/accessibility';

// Re-export FLIP utilities
export { calculateFLIP, applyFLIPAnimation, performFLIPTransition } from '../lib/animations/flip';

// Re-export stagger utilities
export { createStaggerVariants, createListStaggerVariants, getStaggerDelay } from '../lib/animations/stagger';
```

**Step 2: Update animations/index.ts barrel export**

Create/update `src/animations/index.ts`:

```typescript
/**
 * Animation System - Unified Entry Point
 *
 * ALL animation imports should come from '@/animations'.
 * Do NOT import from '@/lib/animations' directly.
 */

// Core tokens
export * from './tokens';

// Variants
export * from './variants';

// Card animations
export * from './card-animations';

// Menu morph
export * from './menu-morph';

// Components
export * from './components';

// Types
export type * from './types';

// Re-exports from lib/animations for backwards compatibility
export {
  useReducedMotion,
  shouldReduceMotion,
  getMotionSafeVariant,
  AnimationProvider,
  useAnimation,
} from '../lib/animations';

// Island-specific (re-export for convenience)
export {
  islandSpring,
  islandContentSpring,
  islandVariants,
  modeContentVariants,
  getModeContentVariants,
  getIslandVariants,
} from '../lib/animations/island-variants';
```

**Step 3: Add deprecation notice to lib/animations/index.ts**

Add at top of `src/lib/animations/index.ts`:

```typescript
/**
 * @deprecated Import from '@/animations' instead.
 * This module is maintained for backwards compatibility only.
 *
 * Example migration:
 *   Before: import { springs } from '@/lib/animations';
 *   After:  import { springs } from '@/animations';
 */
```

**Step 4: Verify build passes**

Run: `npm run type-check && npm test`
Expected: All tests pass, no type errors

**Step 5: Commit**

```bash
git add src/animations/ src/lib/animations/
git commit -m "$(cat <<'EOF'
refactor(animations): unify animation system under @/animations

- Add re-exports to animations/index.ts for complete API
- Deprecate direct imports from @/lib/animations
- Maintain backwards compatibility via re-exports

Migration: Replace '@/lib/animations' imports with '@/animations'

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extend Design Tokens for Missing Values

**Files:**
- Modify: `src/design-system/theme.ts`

**Step 1: Add missing RADIUS values**

Find the RADIUS export and extend it:

```typescript
export const RADIUS = {
  // Existing
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,      // NEW - for intermediate sizes
  '3xl': 24,      // NEW - was using modal (24)
  '4xl': 32,      // NEW - larger containers
  '5xl': 40,      // NEW - for large overlay elements (NedOverlay uses this)
  full: 9999,     // pill/circular

  // Semantic aliases
  modal: 24,
  card: 16,
  field: 12,
  element: 12,
  pill: 9999,
} as const;

export function getRadiusClass(size: keyof typeof RADIUS): string {
  const value = RADIUS[size];
  if (value === 9999) return 'rounded-full';
  if (value === 0) return 'rounded-none';
  return `rounded-[${value}px]`;
}
```

**Step 2: Add SCROLL_THRESHOLDS token**

Add new export:

```typescript
/**
 * Scroll-based animation thresholds
 */
export const SCROLL_THRESHOLDS = {
  // Header collapse animation range
  headerCollapseStart: 150,  // px - animation begins
  headerCollapseEnd: 300,    // px - animation complete

  // Navigation compact mode
  navCompactThreshold: 100,  // px - nav enters compact mode

  // Menu morph pill (used by MenuMorphPill component)
  menuMorphStart: 150,       // px - morph begins
  menuMorphEnd: 220,         // px - morph complete
} as const;
```

**Step 3: Add OVERLAY_DIMENSIONS token**

Add new export:

```typescript
/**
 * Overlay panel dimensions
 */
export const OVERLAY_DIMENSIONS = {
  // Ned AI assistant overlay
  ned: {
    width: '480px',
    maxHeight: 'calc(100vh - 140px)',
    top: '80px',
    right: '1.5rem',
  },

  // Reference panel
  referencePanel: {
    width: '400px',
    maxHeight: 'calc(100vh - 120px)',
  },

  // Sidebar panels
  sidebar: {
    minWidth: '20%',
    maxWidth: '60%',
    defaultWidth: '35%',
  },
} as const;
```

**Step 4: Add NOTIFICATION token**

Add new export:

```typescript
/**
 * Notification/toast configuration
 */
export const NOTIFICATION = {
  dismissAfter: 5000,        // ms - auto-dismiss timeout
  maxWidth: '28rem',         // max-w-md
  gap: '0.5rem',             // spacing between notifications
  position: {
    top: '1rem',
    right: '1rem',
  },
} as const;
```

**Step 5: Add THUMBNAIL_SIZES token**

Add new export:

```typescript
/**
 * Thumbnail and preview dimensions
 */
export const THUMBNAIL_SIZES = {
  screenshot: {
    small: { width: 96, height: 64 },      // w-24 h-16, aspect 3:2
    medium: { width: 120, height: 90 },    // aspect 4:3
    large: { width: 160, height: 120 },    // aspect 4:3
  },
  avatar: {
    small: 32,   // w-8 h-8
    medium: 40,  // w-10 h-10
    large: 56,   // w-14 h-14
  },
} as const;
```

**Step 6: Verify build passes**

Run: `npm run type-check`
Expected: No errors

**Step 7: Commit**

```bash
git add src/design-system/theme.ts
git commit -m "$(cat <<'EOF'
feat(design-system): add missing design tokens

- Extend RADIUS with 2xl, 3xl, 4xl, 5xl sizes
- Add getRadiusClass() helper function
- Add SCROLL_THRESHOLDS for animation breakpoints
- Add OVERLAY_DIMENSIONS for panel sizing
- Add NOTIFICATION for toast configuration
- Add THUMBNAIL_SIZES for consistent preview dimensions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Remove Duplicate Glass/Gradient Functions

**Files:**
- Modify: `src/components/SpaceMenuBar.tsx`

**Step 1: Find and remove duplicate getGradientClass function**

In `src/components/SpaceMenuBar.tsx`, find the local `getGradientClass` function and delete it. Replace with import from theme:

```typescript
// Add to imports at top:
import { getGradientClasses } from '../design-system/theme';

// Delete the local getGradientClass function (usually around lines 50-80)

// Update all usages from getGradientClass() to getGradientClasses()
```

**Step 2: Search for other duplicates**

Run: `grep -r "getGradientClass" src/components --include="*.tsx" | grep -v "import"`

If any other files define their own, delete and import from theme.

**Step 3: Verify build passes**

Run: `npm run type-check && npm test`
Expected: Pass

**Step 4: Commit**

```bash
git add src/components/SpaceMenuBar.tsx
git commit -m "$(cat <<'EOF'
refactor(SpaceMenuBar): use theme getGradientClasses instead of duplicate

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Z-Index Migration (All Components)

### Task 5: Migrate Z-Index in UI Primitives

**Files:**
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/CommandPalette.tsx`

**Step 1: Update dialog.tsx**

```typescript
// Add import
import { Z_INDEX } from '../../design-system/theme';

// Line 23: Replace z-50 or Z_INDEX.modal with new token
className={`fixed inset-0 ${Z_INDEX.overlay} bg-black/20 backdrop-blur-sm ...`}

// Line 40: Modal content
className={`fixed ... ${Z_INDEX.modal} ...`}
```

**Step 2: Update dropdown-menu.tsx**

```typescript
// Add import
import { Z_INDEX } from '../../design-system/theme';

// Line 51, 69: Replace z-[100] with Z_INDEX.dropdown
className={`${Z_INDEX.dropdown} ...`}
```

**Step 3: Update ConfirmDialog.tsx**

```typescript
// Add import
import { Z_INDEX } from '../design-system/theme';

// Line 120: Replace z-[100]
className={`${Z_INDEX.modal} ...`}
```

**Step 4: Update CommandPalette.tsx**

```typescript
// Already imports Z_INDEX - verify it uses the new tokens
// Line 187: Should use Z_INDEX.modal for overlay
```

**Step 5: Verify build and test**

Run: `npm run type-check && npm test`

**Step 6: Commit**

```bash
git add src/components/ui/ src/components/ConfirmDialog.tsx src/components/CommandPalette.tsx
git commit -m "$(cat <<'EOF'
fix(ui): migrate primitives to new z-index system

- dialog.tsx: overlay -> Z_INDEX.overlay, content -> Z_INDEX.modal
- dropdown-menu.tsx: Z_INDEX.dropdown
- ConfirmDialog.tsx: Z_INDEX.modal
- CommandPalette.tsx: Z_INDEX.modal

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Migrate Z-Index in Navigation Components

**Files:**
- Modify: `src/components/TopNavigation/index.tsx`
- Modify: `src/components/MenuMorphPill.tsx`
- Modify: `src/components/MorphingMenuButton.tsx`
- Modify: `src/components/FloatingControls.tsx`
- Modify: `src/components/ProcessingIndicator.tsx`

**Step 1: Update TopNavigation/index.tsx**

```typescript
// Import Z_INDEX from theme (should already exist)
// Line 130: blur overlay - use Z_INDEX.overlay
className={`fixed inset-0 bg-black/20 backdrop-blur-sm ${Z_INDEX.overlay} ...`}

// Line 137: header - use Z_INDEX.sticky
className="fixed top-0 left-0 right-0 ... ${Z_INDEX.sticky} ..."
```

**Step 2: Update MenuMorphPill.tsx**

```typescript
// Add import
import { Z_INDEX, getZIndexValue } from '../design-system/theme';

// Line 448-449 (backdrop overlay): z-[90] -> Z_INDEX.overlay
className={`fixed inset-0 bg-black/5 ${Z_INDEX.overlay}`}

// Line 494 (inline style): zIndex: 100 -> getZIndexValue('dropdown')
style={{
  ...
  zIndex: getZIndexValue('dropdown'),
}}
```

**Step 3: Update MorphingMenuButton.tsx**

```typescript
// Line 247: z-[90] -> Z_INDEX.overlay
```

**Step 4: Update FloatingControls.tsx**

```typescript
// Line 32: Z_INDEX.dropdown -> keep as dropdown (floating action buttons)
```

**Step 5: Update ProcessingIndicator.tsx**

```typescript
// Line 81: Z_INDEX.dropdown -> keep as dropdown
```

**Step 6: Verify and commit**

Run: `npm run type-check && npm test`

```bash
git add src/components/TopNavigation/ src/components/MenuMorphPill.tsx src/components/MorphingMenuButton.tsx src/components/FloatingControls.tsx src/components/ProcessingIndicator.tsx
git commit -m "$(cat <<'EOF'
fix(navigation): migrate to unified z-index tokens

- TopNavigation: sticky header, overlay backdrop
- MenuMorphPill: overlay backdrop, dropdown content
- MorphingMenuButton: overlay
- FloatingControls: dropdown level
- ProcessingIndicator: dropdown level

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Migrate Z-Index in Overlay Components

**Files:**
- Modify: `src/components/NedOverlay.tsx`
- Modify: `src/components/NotificationCenter.tsx`
- Modify: `src/components/FeatureTooltip.tsx`
- Modify: `src/components/QuickTaskModal.tsx`
- Modify: `src/components/QuickNoteFromSession.tsx`
- Modify: `src/components/QuickTaskFromSession.tsx`
- Modify: `src/components/ScreenshotModal.tsx`
- Modify: `src/components/WelcomeFlow.tsx`

**Step 1: Update each file with correct z-index**

| File | Current | New Token |
|------|---------|-----------|
| NedOverlay.tsx:54 | z-[60] | Z_INDEX.overlay |
| NotificationCenter.tsx:61 | Z_INDEX.notification | Z_INDEX.toast |
| FeatureTooltip.tsx:130 | Z_INDEX.tooltip | Z_INDEX.tooltip |
| QuickTaskModal.tsx:148 | z-[100] | Z_INDEX.modal |
| QuickNoteFromSession.tsx:107,117 | z-[60] | Z_INDEX.modal |
| QuickTaskFromSession.tsx:111 | z-[60] | Z_INDEX.modal |
| ScreenshotModal.tsx:42 | z-[9999] | Z_INDEX.modal |
| WelcomeFlow.tsx:80,89 | z-[200] | Z_INDEX.maximum |

**Step 2: Verify and commit**

Run: `npm run type-check && npm test`

```bash
git add src/components/NedOverlay.tsx src/components/NotificationCenter.tsx src/components/FeatureTooltip.tsx src/components/QuickTaskModal.tsx src/components/QuickNoteFromSession.tsx src/components/QuickTaskFromSession.tsx src/components/ScreenshotModal.tsx src/components/WelcomeFlow.tsx
git commit -m "$(cat <<'EOF'
fix(overlays): migrate to unified z-index tokens

- NedOverlay: overlay level
- NotificationCenter: toast level
- FeatureTooltip: tooltip level
- QuickTaskModal, QuickNote/TaskFromSession: modal level
- ScreenshotModal: modal level
- WelcomeFlow: maximum level (critical onboarding)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Migrate Z-Index in Sessions Components

**Files:**
- Modify: `src/components/SessionsZone.tsx`
- Modify: `src/components/sessions/SessionCard.tsx`
- Modify: `src/components/sessions/SessionsFilterMenu.tsx`
- Modify: `src/components/sessions/SessionsSortMenu.tsx`
- Modify: `src/components/sessions/SessionsTopBar.tsx`

**Step 1: Update SessionsZone.tsx**

```typescript
// Line 1524: z-[200] (loading) -> Z_INDEX.maximum
// Line 1558: z-10 -> Z_INDEX.content
// Line 1640: z-50 (sticky bar) -> Z_INDEX.sticky
// Line 1822: z-50 (toast) -> Z_INDEX.toast
```

**Step 2: Update session components**

```typescript
// SessionCard.tsx:132,148 - z-10 -> Z_INDEX.content
// SessionsFilterMenu.tsx:105 - z-[9999] -> Z_INDEX.dropdown
// SessionsSortMenu.tsx:31 - z-[9999] -> Z_INDEX.dropdown
// SessionsTopBar.tsx:502 - z-[9999] -> Z_INDEX.dropdown
```

**Step 3: Verify and commit**

```bash
git add src/components/SessionsZone.tsx src/components/sessions/
git commit -m "$(cat <<'EOF'
fix(sessions): migrate to unified z-index tokens

- SessionsZone: content, sticky, toast, maximum levels
- SessionCard: content level for badges
- Filter/Sort/TopBar menus: dropdown level

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Animation System Migration

### Task 9: Migrate Components from @/lib/animations to @/animations

**Files (HIGH PRIORITY - most used):**
- Modify: `src/main.tsx`
- Modify: `src/components/TopNavigation/components/NavigationIsland.tsx`
- Modify: `src/components/TopNavigation/components/LogoContainer.tsx`
- Modify: `src/components/TopNavigation/components/NavButton.tsx`
- Modify: `src/components/TopNavigation/components/island-modes/*.tsx`

**Step 1: Update each file's imports**

Change:
```typescript
import { useReducedMotion, springs } from '../lib/animations';
// or
import { useReducedMotion } from '../../lib/animations';
```

To:
```typescript
import { useReducedMotion, springs } from '@/animations';
// or relative path based on file location
import { useReducedMotion, springs } from '../animations';
```

**Step 2: Update main.tsx**

```typescript
// Change
import { AnimationProvider } from './lib/animations';
// To
import { AnimationProvider } from './animations';
```

**Step 3: Verify and commit**

Run: `npm run type-check && npm test`

```bash
git add src/main.tsx src/components/TopNavigation/
git commit -m "$(cat <<'EOF'
refactor(navigation): migrate to unified @/animations imports

- Update all TopNavigation components
- Update main.tsx AnimationProvider import
- Consistent import path across codebase

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Migrate Remaining Animation Imports

**Files:**
- Modify: `src/components/RainbowBorderProgressIndicator.tsx`
- Modify: `src/components/morphing-canvas/MorphingCanvas.tsx`
- Modify: `src/components/morphing-canvas/modules/ScreenshotGalleryModule.tsx`
- Modify: `src/components/ned/EnrichmentLoadingBar.tsx`
- Modify: `src/components/AICanvas/FlexibleCanvasRenderer.tsx`
- Modify: `src/components/AICanvas/AICanvasRenderer.tsx`

**Step 1: Update each file**

Same pattern - change `@/lib/animations` to `@/animations`.

**Step 2: Verify and commit**

```bash
git add src/components/RainbowBorderProgressIndicator.tsx src/components/morphing-canvas/ src/components/ned/ src/components/AICanvas/
git commit -m "$(cat <<'EOF'
refactor(components): migrate remaining animation imports

- RainbowBorderProgressIndicator
- MorphingCanvas and modules
- Ned components
- AICanvas components

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Migrate morphing-canvas/animations/transitions.ts Consumers

**Files:**
- Modify: `src/components/AICanvas/heroes/HeroFocus.tsx`
- Modify: `src/components/AICanvas/heroes/HeroProblemSolver.tsx`
- Modify: `src/components/AICanvas/heroes/HeroCelebration.tsx`
- Modify: `src/components/AICanvas/heroes/HeroDiscovery.tsx`
- Modify: `src/components/AICanvas/heroes/HeroTimeline.tsx`
- Modify: `src/components/AICanvas/heroes/HeroSplit.tsx`
- Modify: `src/components/morphing-canvas/registry/index.ts`
- Modify: `src/components/morphing-canvas/modules/NotesModule.tsx`
- Modify: `src/components/morphing-canvas/modules/QuickActionsModule.tsx`

**Step 1: Update imports**

Change:
```typescript
import { fadeInVariants, scaleUpVariants } from '../../morphing-canvas/animations/transitions';
```

To:
```typescript
import { fadeInVariants, scaleUpVariants } from '@/animations';
```

**Step 2: Verify and commit**

```bash
git add src/components/AICanvas/heroes/ src/components/morphing-canvas/
git commit -m "$(cat <<'EOF'
refactor(canvas): migrate from deprecated transitions.ts

- Update all AICanvas hero components
- Update morphing-canvas modules
- Import from @/animations instead of transitions.ts shim

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Extract Inline Animation Configs to Tokens

**Files:**
- Modify: `src/animations/tokens.ts`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/ScreenshotModal.tsx`
- Modify: `src/components/SessionsZone.tsx`
- Modify: `src/components/TasksZone.tsx`
- Modify: `src/components/LibraryZone.tsx`

**Step 1: Add common transition presets to tokens.ts**

Add to `src/animations/tokens.ts`:

```typescript
/**
 * Common component transition presets
 * Use these instead of inline transition objects
 */
export const componentTransitions = {
  // Modal/dialog content entrance
  modalContent: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
    delay: 0.05,
  },

  // Fast fade for UI elements
  fastFade: {
    duration: 0.15,
    ease: 'easeOut',
  },

  // Standard content transition
  content: {
    duration: 0.2,
    ease: 'easeOut',
  },

  // Card hover/interaction
  cardInteraction: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 17,
  },

  // Gallery/grid item transitions
  galleryItem: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
  },
} as const;
```

**Step 2: Update components to use presets**

Example for ConfirmDialog.tsx:
```typescript
import { componentTransitions } from '../animations/tokens';

// Replace inline:
// transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 20 }}
// With:
transition={componentTransitions.modalContent}
```

**Step 3: Verify and commit**

```bash
git add src/animations/tokens.ts src/components/ConfirmDialog.tsx src/components/ScreenshotModal.tsx src/components/SessionsZone.tsx src/components/TasksZone.tsx src/components/LibraryZone.tsx
git commit -m "$(cat <<'EOF'
refactor(animations): extract inline configs to tokens

- Add componentTransitions preset collection
- Update ConfirmDialog, ScreenshotModal
- Update Zone components
- Consistent animation feel across app

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Glass Morphism Standardization

### Task 13: Migrate High-Priority Glass Components

**Files:**
- Modify: `src/components/NavigationIsland.tsx`
- Modify: `src/components/MenuMorphPill.tsx`
- Modify: `src/components/SessionsZone.tsx`
- Modify: `src/components/ChapterGenerator.tsx`
- Modify: `src/components/CleanNotesButton.tsx`

**Step 1: Update each component**

Replace hardcoded patterns with `getGlassClasses()`:

```typescript
// Before (NavigationIsland.tsx:252-253)
className="backdrop-blur-2xl rounded-[40px] shadow-2xl border-2 border-white/50"

// After
import { getGlassClasses, getRadiusClass } from '../../design-system/theme';
className={`${getGlassClasses('strong')} ${getRadiusClass('5xl')}`}
```

Pattern mapping:
- `bg-white/30 backdrop-blur-sm` → `getGlassClasses('subtle')`
- `bg-white/50 backdrop-blur-xl` → `getGlassClasses('medium')`
- `bg-white/40 backdrop-blur-2xl` → `getGlassClasses('strong')`
- `bg-white/60 backdrop-blur-2xl` → `getGlassClasses('extra-strong')`

**Step 2: Verify and commit**

```bash
git add src/components/TopNavigation/components/NavigationIsland.tsx src/components/MenuMorphPill.tsx src/components/SessionsZone.tsx src/components/ChapterGenerator.tsx src/components/CleanNotesButton.tsx
git commit -m "$(cat <<'EOF'
refactor(glass): migrate high-priority components to getGlassClasses

- NavigationIsland: strong glass
- MenuMorphPill: medium glass
- SessionsZone: strong glass for floating containers
- ChapterGenerator, CleanNotesButton: medium glass

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Migrate Remaining Glass Components (Batch 1)

**Files:**
- Modify: `src/components/CaptureZone.tsx`
- Modify: `src/components/TasksZone.tsx`
- Modify: `src/components/LibraryZone.tsx`
- Modify: `src/components/ProfileZone.tsx`
- Modify: `src/components/Button.tsx`

**Step 1: Update each Zone component**

Search for `bg-white/` and `backdrop-blur` patterns, replace with appropriate `getGlassClasses()` call.

**Step 2: Verify and commit**

```bash
git add src/components/CaptureZone.tsx src/components/TasksZone.tsx src/components/LibraryZone.tsx src/components/ProfileZone.tsx src/components/Button.tsx
git commit -m "$(cat <<'EOF'
refactor(glass): migrate zone components and Button

- All zone components now use getGlassClasses()
- Button secondary variant uses glass tokens
- Consistent glass styling across app

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Migrate Remaining Glass Components (Batch 2)

**Files:**
- Modify: `src/components/sessions/*.tsx` (all session components)
- Modify: `src/components/TopNavigation/components/*.tsx`
- Modify: `src/components/ned/*.tsx`

**Step 1: Batch update all files**

Use same pattern - replace hardcoded glass with `getGlassClasses()`.

**Step 2: Verify and commit**

```bash
git add src/components/sessions/ src/components/TopNavigation/components/ src/components/ned/
git commit -m "$(cat <<'EOF'
refactor(glass): migrate sessions, navigation, and ned components

- All session components use getGlassClasses()
- All TopNavigation subcomponents standardized
- Ned chat and tool components updated

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Magic Number Extraction

### Task 16: Replace Hardcoded Rounded Corners

**Files:**
- All files identified in magic numbers audit using `rounded-[Xpx]`

**Step 1: Search and replace pattern**

Use the new `getRadiusClass()` helper:

```typescript
// Before
className="rounded-[24px]"

// After
import { getRadiusClass } from '../design-system/theme';
className={getRadiusClass('3xl')}  // 24px
```

Mapping:
- `rounded-[12px]` → `getRadiusClass('lg')` or `rounded-xl`
- `rounded-[16px]` → `getRadiusClass('xl')` or `rounded-2xl`
- `rounded-[20px]` → `getRadiusClass('2xl')`
- `rounded-[24px]` → `getRadiusClass('3xl')`
- `rounded-[32px]` → `getRadiusClass('4xl')`
- `rounded-[40px]` → `getRadiusClass('5xl')`
- `rounded-[9999px]` → `getRadiusClass('full')` or `rounded-full`

**Step 2: Verify and commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
refactor(radius): replace hardcoded rounded corners with tokens

- All arbitrary rounded-[Xpx] values now use getRadiusClass()
- Consistent border radius across app

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Replace Hardcoded Scroll Thresholds

**Files:**
- Modify: `src/components/TopNavigation/index.tsx`
- Modify: `src/components/MenuMorphPill.tsx`
- Modify: `src/components/SessionDetailView.tsx`
- Modify: `src/hooks/useCompactNavigation.ts`

**Step 1: Import and use SCROLL_THRESHOLDS**

```typescript
import { SCROLL_THRESHOLDS } from '../design-system/theme';

// Before
if (scrollY >= 100) { ... }

// After
if (scrollY >= SCROLL_THRESHOLDS.navCompactThreshold) { ... }
```

**Step 2: Verify and commit**

```bash
git add src/components/TopNavigation/ src/components/MenuMorphPill.tsx src/components/SessionDetailView.tsx src/hooks/useCompactNavigation.ts
git commit -m "$(cat <<'EOF'
refactor(scroll): use SCROLL_THRESHOLDS tokens

- Navigation compact mode uses navCompactThreshold
- MenuMorphPill uses menuMorphStart/menuMorphEnd
- SessionDetailView uses headerCollapseStart/End
- Centralized scroll breakpoints for coordinated animations

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Replace Hardcoded Dimensions

**Files:**
- Modify: `src/components/NedOverlay.tsx`
- Modify: `src/components/ScreenshotCard.tsx`
- Modify: `src/components/ScreenshotScrubber.tsx`
- Modify: `src/components/NotificationCenter.tsx`

**Step 1: Use OVERLAY_DIMENSIONS and THUMBNAIL_SIZES**

```typescript
import { OVERLAY_DIMENSIONS, THUMBNAIL_SIZES } from '../design-system/theme';

// NedOverlay
style={{
  width: OVERLAY_DIMENSIONS.ned.width,
  maxHeight: OVERLAY_DIMENSIONS.ned.maxHeight,
  top: OVERLAY_DIMENSIONS.ned.top,
}}

// ScreenshotCard
const { width, height } = THUMBNAIL_SIZES.screenshot.medium;
```

**Step 2: Use NOTIFICATION token**

```typescript
// NotificationCenter
const DISMISS_AFTER = NOTIFICATION.dismissAfter;
```

**Step 3: Verify and commit**

```bash
git add src/components/NedOverlay.tsx src/components/ScreenshotCard.tsx src/components/ScreenshotScrubber.tsx src/components/NotificationCenter.tsx
git commit -m "$(cat <<'EOF'
refactor(dimensions): use OVERLAY_DIMENSIONS and THUMBNAIL_SIZES tokens

- NedOverlay uses ned overlay dimensions
- Screenshot components use thumbnail sizes
- NotificationCenter uses notification tokens
- Centralized dimension management

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Final Cleanup

### Task 19: Delete Deprecated Animation Files

**Files:**
- Delete: `src/components/morphing-canvas/animations/transitions.ts`

**Step 1: Verify no remaining imports**

Run: `grep -r "morphing-canvas/animations/transitions" src/`
Expected: No results

**Step 2: Delete file**

```bash
rm src/components/morphing-canvas/animations/transitions.ts
```

**Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove deprecated transitions.ts compatibility shim

All consumers migrated to @/animations imports.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Run Full Test Suite and Fix Any Breakages

**Step 1: Run all tests**

```bash
npm run type-check && npm test
```

**Step 2: Fix any failures**

Address each failure based on error message.

**Step 3: Run visual check**

```bash
npm run dev
```

Manually verify:
- [ ] Navigation island expands/collapses correctly
- [ ] Modals layer correctly (dropdown below modal)
- [ ] Tooltips appear above other elements
- [ ] Glass morphism looks consistent
- [ ] Animations feel cohesive

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve test failures from design system refactor

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Update CLAUDE.md with New Design System Patterns

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add design system usage section**

Add after the existing Design System section:

```markdown
### Design Token Usage (Required)

**Z-Index**: Always use `Z_INDEX` tokens from theme:
```typescript
import { Z_INDEX } from '@/design-system/theme';
// Use: Z_INDEX.dropdown, Z_INDEX.modal, Z_INDEX.tooltip, etc.
// Never: z-[9999], z-50, or hardcoded values
```

**Glass Morphism**: Always use `getGlassClasses()`:
```typescript
import { getGlassClasses } from '@/design-system/theme';
className={getGlassClasses('strong')}  // 'subtle' | 'medium' | 'strong' | 'extra-strong'
// Never: inline bg-white/40 backdrop-blur-xl patterns
```

**Animations**: Always import from `@/animations`:
```typescript
import { springs, durations, componentTransitions, useReducedMotion } from '@/animations';
// Never: import from @/lib/animations (deprecated)
```

**Border Radius**: Use RADIUS tokens or getRadiusClass():
```typescript
import { getRadiusClass, RADIUS } from '@/design-system/theme';
className={getRadiusClass('3xl')}  // 24px
// Never: rounded-[24px] arbitrary values
```

**Scroll Thresholds**: Use SCROLL_THRESHOLDS:
```typescript
import { SCROLL_THRESHOLDS } from '@/design-system/theme';
if (scrollY >= SCROLL_THRESHOLDS.navCompactThreshold) { ... }
// Never: hardcoded if (scrollY >= 100)
```
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: add design system usage guidelines to CLAUDE.md

Document required patterns for z-index, glass morphism, animations,
border radius, and scroll thresholds to prevent future drift.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `npm run type-check` passes with no errors
- [ ] `npm test` passes all tests
- [ ] `npm run dev` starts without errors
- [ ] No duplicate `Z_INDEX` definitions exist
- [ ] No imports from `@/lib/animations` in components (only re-exports in @/animations)
- [ ] No `rounded-[Xpx]` arbitrary values (search: `grep -r "rounded-\[" src/components`)
- [ ] No hardcoded `z-[XXXX]` values (search: `grep -r "z-\[" src/components`)
- [ ] No hardcoded glass patterns bypassing getGlassClasses (search: `grep -r "backdrop-blur" src/components`)

---

## Rollback Plan

If issues arise, each phase can be reverted independently:

```bash
# Revert Phase 1 (foundation)
git revert <commit-hash-task-1> <commit-hash-task-2> ...

# Or revert entire refactor
git revert --no-commit HEAD~21..HEAD
git commit -m "revert: rollback design system refactor"
```

---

## Summary

| Phase | Tasks | Files Touched | Risk Level |
|-------|-------|---------------|------------|
| 1. Foundation | 1-4 | ~10 | Low |
| 2. Z-Index Migration | 5-8 | ~25 | Medium |
| 3. Animation Migration | 9-12 | ~30 | Medium |
| 4. Glass Standardization | 13-15 | ~40 | Low |
| 5. Magic Numbers | 16-18 | ~20 | Low |
| 6. Cleanup | 19-21 | ~5 | Low |

**Total: 21 tasks, ~130 file modifications**

This plan prioritizes correctness over speed. Each task is independently testable and commitable, allowing for incremental progress with confidence.
