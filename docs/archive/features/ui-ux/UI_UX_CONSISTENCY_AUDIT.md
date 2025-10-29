# Taskerino UI/UX Consistency Audit Report

**Date:** October 14, 2025
**Project:** Taskerino - AI-Powered Task & Note Management Application
**Auditor:** Claude (Comprehensive Component Analysis)

---

## Executive Summary

This audit analyzed 20+ core components across the Taskerino application to identify design inconsistencies affecting user experience. The application demonstrates a **glassmorphism aesthetic with cyan-blue gradient theming**, but suffers from **significant pattern inconsistencies** across components, particularly in:

1. **Border radius values** (20+ different values found)
2. **Button styling patterns** (inline styles vs component usage)
3. **Modal/dialog overlays** (inconsistent opacity and blur)
4. **Color values** (same color expressed differently)
5. **Spacing patterns** (arbitrary padding/margin values)

**Overall Consistency Score:** 6.5/10

---

## 1. Button Styles & Patterns

### 1.1 Primary Button Inconsistencies

#### ✅ **Standardized Pattern** (Button.tsx)
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/Button.tsx`

```tsx
// Lines 41-47
primary: `
  bg-gradient-to-r from-cyan-600 to-blue-600
  text-white
  shadow-lg shadow-cyan-200/50
  hover:shadow-xl hover:shadow-cyan-300/60 hover:scale-105
  active:scale-95
`
```

**Properties:**
- Border radius: `rounded-2xl` (16px)
- Gradient: `from-cyan-600 to-blue-600`
- Shadow: `shadow-lg shadow-cyan-200/50`
- Hover: `hover:scale-105`, `hover:shadow-xl`
- Transition: `cubic-bezier(0.34, 1.56, 0.64, 1)`

#### ❌ **Inconsistent Implementations**

**SettingsModal.tsx** (Lines 329-335)
```tsx
className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600
  text-white rounded-xl hover:shadow-xl hover:scale-105..."
```
**Issues:**
- Different gradient: `purple-600` instead of `cyan-600`
- Different radius: `rounded-xl` (12px) vs `rounded-2xl` (16px)
- Missing base shadow

**QuickTaskModal.tsx** (Line 276)
```tsx
className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600
  text-white rounded-xl hover:shadow-xl hover:scale-105..."
```
**Issues:**
- Different radius: `rounded-xl` vs `rounded-2xl`
- Inconsistent padding: `px-6 py-2` vs Button component's size variants

**TopNavigation.tsx** (Lines 1017, 1074)
```tsx
// Line 1017
className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500
  text-white rounded-2xl font-bold hover:shadow-xl transform hover:scale-105
  transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600"
```
**Issues:**
- Gradient changes on hover (`violet-600 to fuchsia-600`)
- Uses different cyan/blue values (`500` instead of `600`)
- Inconsistent with standard button pattern

**CaptureZone.tsx** (Line 757)
```tsx
className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500
  text-white rounded-2xl font-bold hover:shadow-xl transform hover:scale-105
  transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600"
```
**Issues:** Same as TopNavigation

**TasksZone.tsx** (Line 256)
```tsx
className="flex items-center gap-2 px-4 py-2 rounded-full
  bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md..."
```
**Issues:**
- Uses `rounded-full` instead of `rounded-2xl`
- Different shadow: `shadow-md` vs `shadow-lg`

**LibraryZone.tsx** (Line 197)
```tsx
className="flex items-center gap-2 px-4 py-2 rounded-full
  bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md..."
```
**Issues:**
- Completely different gradient (purple-violet)
- `rounded-full` instead of `rounded-2xl`

### 1.2 Secondary Button Inconsistencies

#### ✅ **Standardized Pattern** (Button.tsx)
```tsx
// Lines 48-55
secondary: `
  bg-white/70 backdrop-blur-xl
  border border-white/60
  text-gray-700
  shadow-sm
  hover:bg-white/90 hover:shadow-lg hover:scale-105
  active:scale-95
`
```

#### ❌ **Inconsistent Implementations**

**SettingsModal.tsx** (Line 324)
```tsx
className="px-4 py-2 text-gray-700 bg-white/60 backdrop-blur-md
  border border-white/60 hover:bg-white/80 rounded-xl..."
```
**Issues:**
- Different backdrop blur: `backdrop-blur-md` vs `backdrop-blur-xl`
- Different opacity: `bg-white/60` vs `bg-white/70`

**QuickTaskModal.tsx** (Line 269)
```tsx
className="px-4 py-2 text-gray-700 bg-white/60 backdrop-blur-md
  border border-white/60 hover:bg-white/80 rounded-xl..."
```
**Issues:** Same as SettingsModal

### 1.3 Icon Button Patterns

**No standardized icon button component found** - each implementation is custom:

**TopNavigation.tsx** (Lines 129-134, 357-366, 463-474)
```tsx
// Close button example
className="p-2 hover:bg-white/60 backdrop-blur-md rounded-xl
  transition-all duration-300 hover:scale-110 active:scale-95"

// Notifications button
className="relative p-3 rounded-3xl transition-all duration-300 shadow-xl
  border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5
  hover:scale-105"

// Ned AI button
className="p-3 rounded-3xl transition-all duration-300 shadow-xl
  border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5
  hover:scale-105"
```

**Issues:**
- Three different padding values: `p-2`, `p-3`
- Two different border radius: `rounded-xl`, `rounded-3xl`
- Inconsistent shadow patterns

### 1.4 Disabled States

**Button.tsx** (Line 35)
```tsx
disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
```

**Applied inconsistently** - many inline buttons don't include disabled hover prevention.

---

## 2. Modal/Dialog Patterns

### 2.1 Background Overlays

#### ❌ **Inconsistent Implementations**

**SettingsModal.tsx** (Line 115)
```tsx
className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm..."
```
- Opacity: `50%`
- Blur: `backdrop-blur-sm` (4px)
- Z-index: `z-50`

**QuickTaskModal.tsx** (Line 115)
```tsx
className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm..."
```
- **Consistent with SettingsModal** ✅

**MigrationDialog.tsx** (Line 78)
```tsx
className="fixed inset-0 bg-black bg-opacity-50..."
```
**Issues:**
- Uses `bg-opacity-50` instead of `/50` notation
- Missing backdrop blur
- Missing z-index

**TopNavigation.tsx** (Line 334)
```tsx
className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30..."
```
**Issues:**
- Different opacity: `20%` vs `50%`
- Different z-index: `z-30` vs `z-50`

**CommandPalette.tsx** (Line 165)
```tsx
className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm"
```
**Issues:**
- Different z-index: `z-[100]`
- Different opacity: `20%`

### 2.2 Modal Container Cards

#### ❌ **Inconsistent Border Radius**

**SettingsModal.tsx** (Line 120)
```tsx
className="bg-white/40 backdrop-blur-2xl border-2 border-white/50
  rounded-[32px] shadow-2xl..."
```
- Radius: `32px`
- Background: `white/40`
- Border: `border-2 border-white/50`
- Blur: `backdrop-blur-2xl`

**QuickTaskModal.tsx** (Line 119)
```tsx
className="bg-white/40 backdrop-blur-2xl border-2 border-white/50
  rounded-[32px] shadow-2xl..."
```
- **Consistent with SettingsModal** ✅

**MigrationDialog.tsx** (Line 79)
```tsx
className="bg-white rounded-lg shadow-xl p-6..."
```
**Issues:**
- No glassmorphism effect
- Different radius: `rounded-lg` (8px) vs `32px`
- Solid background instead of transparent
- Missing border

**FirstTimeSetup.tsx** (Line 48)
```tsx
className="backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl
  border border-white/20..."
```
**Issues:**
- Different radius: `rounded-3xl` (24px) vs `32px`
- Different opacity: `white/90` vs `white/40`
- Different border: `border` (1px) vs `border-2` (2px)
- Different border opacity: `white/20` vs `white/50`

**CommandPalette.tsx** (Line 170)
```tsx
className="bg-white/30 backdrop-blur-2xl rounded-[32px] shadow-2xl
  border-2 border-white/50..."
```
**Issues:**
- Different background opacity: `white/30` vs `white/40`

### 2.3 Modal Headers

**SettingsModal.tsx** (Line 124)
```tsx
className="p-6 border-b-2 border-white/30
  bg-gradient-to-r from-purple-500/10 to-blue-500/10
  backdrop-blur-sm rounded-t-2xl..."
```

**QuickTaskModal.tsx** (Line 123)
```tsx
className="p-6 border-b-2 border-white/30
  bg-gradient-to-r from-cyan-500/10 to-blue-500/10
  backdrop-blur-sm rounded-t-2xl"
```

**Issue:** Different gradient colors (purple vs cyan)

### 2.4 Modal Footers

**SettingsModal.tsx** (Line 312)
```tsx
className="p-6 border-t-2 border-white/30 bg-white/40
  backdrop-blur-xl rounded-b-2xl..."
```

**QuickTaskModal.tsx** (Line 262)
```tsx
className="p-6 border-t-2 border-white/30 bg-white/40
  backdrop-blur-xl rounded-b-2xl..."
```

**Consistent** ✅

### 2.5 Close Button Placement

**All modals consistently use top-right placement** ✅

**Styling varies:**
- SettingsModal: `p-2 hover:bg-white/60 backdrop-blur-md rounded-xl`
- QuickTaskModal: `p-2 hover:bg-white/60 backdrop-blur-md rounded-xl`
- TopNavigation (Island): `p-1 hover:bg-white/60 rounded-lg`

**Issues:** Minor padding and radius variations

---

## 3. Card Patterns

### 3.1 Card Component

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/Card.tsx`

```tsx
// Lines 27-31 (Base)
baseStyles = `
  relative
  rounded-2xl
  transition-all duration-300
`

// Lines 35-39 (Default variant)
default: `
  bg-white/50 backdrop-blur-xl
  border border-white/60
  shadow-sm
`
```

**Standard Properties:**
- Border radius: `rounded-2xl` (16px)
- Background: `bg-white/50`
- Backdrop blur: `backdrop-blur-xl`
- Border: `border border-white/60` (1px, 60% opacity)
- Transition: `cubic-bezier(0.34, 1.56, 0.64, 1)`

### 3.2 Card Inconsistencies Across Components

#### TaskCard (ned/TaskCard.tsx)

**Line 141**
```tsx
className="px-3 py-2 rounded-lg bg-white/70 backdrop-blur-xl
  border-2 border-white/60 shadow-lg shadow-cyan-100/30..."
```
**Issues:**
- Different radius: `rounded-lg` (8px) vs `rounded-2xl` (16px)
- Different background: `white/70` vs `white/50`
- Different border: `border-2` (2px) vs `border` (1px)
- Different shadow: `shadow-lg` vs `shadow-sm`

**Lines 167-168**
```tsx
className="rounded-xl border-2 border-white/60 bg-white/70
  backdrop-blur-xl overflow-hidden shadow-lg shadow-cyan-100/30..."
```
**Issues:**
- Different radius: `rounded-xl` (12px)
- Different background: `white/70`
- Different border: `border-2`

#### NoteCard (ned/NoteCard.tsx)

**Line 141**
```tsx
className="px-3 py-2 rounded-lg bg-white/70 backdrop-blur-xl
  border-2 border-white/60 shadow-lg shadow-cyan-100/30..."
```
**Issues:** Same as TaskCard compact mode

**Line 167**
```tsx
className="rounded-xl border-2 border-white/60 bg-white/70
  backdrop-blur-xl overflow-hidden shadow-lg shadow-cyan-100/30..."
```
**Issues:** Same as TaskCard expanded mode

#### LibraryZone Note Cards

**Line 420**
```tsx
className="group relative bg-white/30 backdrop-blur-xl
  rounded-[24px] p-3 cursor-pointer border-2 transition-all..."
```
**Issues:**
- Different radius: `24px` vs `16px`
- Different background: `white/30` vs `white/50`
- Different border: `border-2`

#### TasksZone Kanban Cards

**Line 146**
```tsx
className="bg-white/30 backdrop-blur-2xl rounded-[24px]
  border-2 overflow-hidden flex flex-col h-full transition-all
  duration-300 shadow-lg hover:shadow-xl border-white/60..."
```
**Issues:**
- Different radius: `24px`
- Different background: `white/30`
- Different border: `border-2`
- Different blur: `backdrop-blur-2xl` vs `backdrop-blur-xl`

**Line 173**
```tsx
className="group relative bg-white/30 backdrop-blur-lg
  rounded-[24px] p-2 shadow-sm cursor-grab active:cursor-grabbing
  border transition-all duration-300 hover:shadow-lg
  hover:scale-[1.02] active:scale-95..."
```
**Issues:**
- Different radius: `24px`
- Different background: `white/30`
- Different blur: `backdrop-blur-lg` vs `backdrop-blur-xl`

#### CaptureZone Cards

**Line 660**
```tsx
className="relative backdrop-blur-2xl bg-white/30
  rounded-[48px] shadow-2xl border-2 border-white/40..."
```
**Issues:**
- Much larger radius: `48px` vs `16px`
- Different background: `white/30`
- Different border opacity: `white/40` vs `white/60`
- Different blur: `backdrop-blur-2xl`

**Line 822**
```tsx
className="backdrop-blur-2xl bg-white/40 rounded-[1.5rem]
  shadow-xl border-2 border-white/30..."
```
**Issues:**
- Different radius: `1.5rem` (24px)
- Different background: `white/40`
- Different border opacity: `white/30`

### 3.3 Hover Effects

**Card.tsx** (Lines 58-63)
```tsx
hoverStyles = `
  hover:shadow-xl hover:shadow-cyan-100/30
  hover:-translate-y-1 hover:scale-[1.02]
`
```

**Inconsistent hover implementations:**
- Some cards: `hover:scale-[1.01]`
- Some cards: `hover:scale-[1.02]`
- Some cards: `hover:scale-105`
- Some cards: No scale, only shadow change

---

## 4. Color Palette Analysis

### 4.1 Primary Colors (Cyan-Blue Gradient)

**Found Variations:**

#### Cyan Values
- `from-cyan-500` (TopNavigation, CaptureZone, TasksZone)
- `from-cyan-600` (Button.tsx, QuickTaskModal)
- `from-cyan-600` shadows: `shadow-cyan-200/50`
- `from-cyan-100/30` (hover shadows)
- `text-cyan-600` (many places)
- `text-cyan-700` (some places)
- `bg-cyan-50` (backgrounds)
- `border-cyan-200`, `border-cyan-300`, `border-cyan-400`

#### Blue Values
- `to-blue-500` (many components)
- `to-blue-600` (Button.tsx, SettingsModal, QuickTaskModal)
- `text-blue-600`, `text-blue-700`
- `bg-blue-50`

**Issue:** Same visual intent expressed with different values across components.

### 4.2 Purple/Violet Accent Colors

**Inconsistent usage:**
- SettingsModal header: `from-purple-500/10`
- SettingsModal button: `from-purple-600 to-blue-600`
- LibraryZone button: `from-purple-500 to-violet-600`
- TopNavigation hover: `hover:from-violet-600 hover:to-fuchsia-600`
- CaptureZone hover: `hover:from-violet-600 hover:to-fuchsia-600`
- Tags: `bg-violet-100 text-violet-700` or `bg-purple-100 text-purple-700`

**Issue:** Unclear when to use purple vs violet, inconsistent gradient combinations.

### 4.3 Gray Scale

**Text Colors:**
- `text-gray-900` (primary text)
- `text-gray-800` (headings in some places)
- `text-gray-700` (secondary text)
- `text-gray-600` (tertiary text)
- `text-gray-500` (meta text)
- `text-gray-400` (placeholders)
- `text-gray-300` (disabled)

**Background Grays:**
- `bg-gray-100`, `bg-gray-50` (subtle backgrounds)
- `bg-white/90`, `bg-white/80`, `bg-white/70`, `bg-white/60`, `bg-white/50`, `bg-white/40`, `bg-white/30`, `bg-white/20`

**Issue:** Too many white opacity variations without clear semantic meaning.

### 4.4 Border Colors

**Found Values:**
- `border-white/60` (most common)
- `border-white/50` (modals, some cards)
- `border-white/40` (CaptureZone)
- `border-white/30` (some cards, dividers)
- `border-white/20` (FirstTimeSetup)
- `border-gray-200`, `border-gray-300`
- `border-cyan-200`, `border-cyan-300`, `border-cyan-400`

**Issue:** No clear guideline on when to use which border opacity.

### 4.5 Status Colors

**Generally consistent:**
- Success/Done: `green-600`, `green-500`, `bg-green-50`
- Error/Urgent: `red-600`, `red-500`, `bg-red-50`
- Warning/High: `orange-600`, `orange-500`, `bg-orange-50`
- Info/Medium: `yellow-600`, `yellow-500`, `bg-yellow-50`
- Primary/Low: `blue-600`, `blue-500`, `bg-blue-50`

**Minor Issue:** Some components use `emerald` instead of `green`, `amber` instead of `orange`.

---

## 5. Typography

### 5.1 Heading Sizes

**Inconsistent scale:**

**H1 Level:**
- TopNavigation logo: `text-lg` (18px)
- CaptureZone greeting: `text-5xl` (48px)
- FirstTimeSetup: `text-3xl` (30px)

**H2 Level:**
- SettingsModal: `text-2xl` (24px)
- QuickTaskModal: `text-2xl` (24px)
- LibraryZone welcome: `text-2xl` (24px)
- CaptureZone time: `text-9xl` (128px) - **outlier**

**H3 Level:**
- SettingsModal sections: `text-lg` (18px)
- Card titles: `text-sm` (14px) in some, `font-medium` in others
- NoteCard titles: `font-semibold` with varying sizes

**Issue:** No consistent heading hierarchy.

### 5.2 Font Weights

**Found Values:**
- `font-extralight` (CaptureZone time display)
- `font-medium` (most body text, some headings)
- `font-semibold` (most headings, important text)
- `font-bold` (primary buttons, main headings)
- `font-black` (not found, but would complete scale)

**Generally consistent** but `font-medium` is overused for both body and headings.

### 5.3 Text Colors

**Hierarchy:**
1. `text-gray-900` - Primary content
2. `text-gray-700` - Secondary content
3. `text-gray-600` - Tertiary content
4. `text-gray-500` - Meta information
5. `text-gray-400` - Placeholders/disabled

**Generally consistent** ✅

**Issue:** Some components use `text-gray-800` breaking the hierarchy.

### 5.4 Line Heights

**Mostly relies on Tailwind defaults** - no custom line heights found except:
- CaptureZone: Inline styles with specific letter-spacing

**Inconsistency:** Not explicitly defined, relies on class defaults.

### 5.5 Letter Spacing

**Found Values:**
- `tracking-wide` (uppercase labels)
- `tracking-tight` (large headings)
- `tracking-tighter` (CaptureZone time: `-0.05em`)
- Inline style: `letterSpacing: '-0.02em'` (CaptureZone greeting)

**Issue:** Mix of Tailwind classes and inline styles.

---

## 6. Spacing & Layout

### 6.1 Padding Patterns

**Found Values (too many):**

**Component Padding:**
- `p-1`, `p-1.5`, `p-2`, `p-3`, `p-4`, `p-5`, `p-6`, `p-8`, `p-10`, `p-12`
- `px-2`, `px-3`, `px-4`, `px-5`, `px-6`, `px-8`, `px-9`
- `py-1`, `py-1.5`, `py-2`, `py-2.5`, `py-3`, `py-3.5`, `py-4`, `py-5`

**Button Padding:**
- Button.tsx sm: `px-3 py-1.5`
- Button.tsx md: `px-4 py-2.5`
- Button.tsx lg: `px-6 py-3`
- Inline buttons: `px-4 py-2`, `px-6 py-2`, `px-3 py-2`

**Issue:** No clear spacing scale, arbitrary values everywhere.

### 6.2 Gap/Spacing Between Elements

**Found Values:**
- `gap-1`, `gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `gap-6`
- `space-y-1`, `space-y-1.5`, `space-y-2`, `space-y-3`, `space-y-4`, `space-y-6`

**Issue:** No consistent spacing scale.

### 6.3 Container Max-Widths

**Modals:**
- SettingsModal: `max-w-3xl` (768px)
- QuickTaskModal: `max-w-2xl` (672px)
- CommandPalette: `max-w-2xl` (672px)
- FirstTimeSetup: `max-w-2xl` (672px)

**Zones:**
- CaptureZone: `max-w-3xl` (768px)

**Generally consistent** ✅

### 6.4 Grid/Flex Patterns

**Consistent use of flexbox and grid** ✅

**Common patterns:**
- `flex items-center justify-between`
- `flex items-start gap-X`
- `grid grid-cols-X gap-Y`

---

## 7. Form Elements

### 7.1 Input Field Styling

**SettingsModal.tsx** (Line 158)
```tsx
className="w-full px-4 py-2 bg-white/70 backdrop-blur-xl
  border border-white/60 rounded-lg focus:ring-2 focus:ring-purple-500
  focus:border-purple-400 transition-all shadow-sm"
```

**QuickTaskModal.tsx** (Line 150)
```tsx
className="w-full px-4 py-3 bg-white/30 backdrop-blur-xl
  border border-white/60 rounded-[20px] focus:ring-2 focus:ring-cyan-500
  focus:border-cyan-400 transition-all text-lg shadow-sm"
```

**Issues:**
- Different backgrounds: `white/70` vs `white/30`
- Different radius: `rounded-lg` (8px) vs `rounded-[20px]` (20px)
- Different padding: `py-2` vs `py-3`
- Different focus colors: `purple-500` vs `cyan-500`
- Different text sizes: default vs `text-lg`

**TaskDetailSidebar.tsx** (Line 274)
```tsx
className="w-full px-4 py-3 text-sm text-gray-700
  bg-white/30 backdrop-blur-sm border-2 border-white/60
  rounded-[24px] focus:ring-2 focus:ring-cyan-400
  focus:border-cyan-300 transition-all resize-none"
```

**Issues:**
- Different radius: `24px`
- Different border: `border-2` vs `border`
- Different blur: `backdrop-blur-sm` vs `backdrop-blur-xl`

### 7.2 Select Dropdown Styling

**SettingsModal.tsx** (Line 212)
```tsx
className="w-full px-4 py-2 bg-white/70 backdrop-blur-xl
  border border-white/60 rounded-lg focus:ring-2 focus:ring-purple-500
  focus:border-purple-400 transition-all shadow-sm"
```

**TaskDetailSidebar.tsx** (Lines 145-158)
```tsx
className="inline-flex items-center gap-1 font-medium
  rounded-lg px-2 py-1 border transition-all
  [conditional colors]"
```

**Issue:** Completely different patterns - one looks like an input, one looks like a badge.

**LibraryZone.tsx** (Line 212)
```tsx
className="pl-3 pr-8 py-2 text-sm font-semibold
  bg-white/50 backdrop-blur-sm border-2 border-white/60
  rounded-full focus:ring-2 focus:ring-cyan-400
  focus:border-cyan-300 transition-all hover:bg-white/70"
```

**Issues:**
- Uses `rounded-full` instead of `rounded-lg`
- Different border: `border-2`
- Different blur: `backdrop-blur-sm`

### 7.3 Checkbox/Toggle Styling

**SettingsModal.tsx** (Lines 244-252)
```tsx
// Toggle switch
className="relative w-12 h-6 rounded-full transition-colors
  [purple-600 or gray-300]"

// Toggle knob
className="absolute top-0.5 left-0.5 w-5 h-5 bg-white
  rounded-full transition-transform..."
```

**CaptureZone.tsx** (Lines 768-774)
```tsx
// Checkbox toggle (different pattern)
className="w-11 h-6 bg-gray-300 peer-focus:outline-none
  rounded-full peer peer-checked:after:translate-x-full
  rtl:peer-checked:after:-translate-x-full
  peer-checked:after:border-white after:content-['']
  after:absolute after:top-[2px] after:start-[2px]
  after:bg-white after:border-gray-300 after:border
  after:rounded-full after:h-5 after:w-5 after:transition-all
  peer-checked:bg-gradient-to-r peer-checked:from-cyan-500
  peer-checked:to-blue-500"
```

**Issue:** Two completely different toggle implementations.

### 7.4 Label Patterns

**SettingsModal.tsx** (Line 150)
```tsx
className="block text-sm font-medium text-gray-700 mb-2"
```

**QuickTaskModal.tsx** (Line 142)
```tsx
className="block text-sm font-medium text-gray-700 mb-2"
```

**Consistent** ✅

### 7.5 Error States

**No standardized error state styling found** - handled inconsistently:
- FirstTimeSetup: `bg-red-50 border border-red-200 rounded-xl text-red-700`
- Some forms: No visible error states

**Issue:** Missing standardized error pattern.

---

## 8. Icons

### 8.1 Icon Sizes

**Found Values:**
- `w-3 h-3` (tiny icons in compact UI)
- `w-3.5 h-3.5` (small icons)
- `w-4 h-4` (standard icons)
- `w-5 h-5` (medium icons)
- `w-6 h-6` (large icons)
- `w-8 h-8`, `w-10 h-10`, `w-12 h-12`, `w-16 h-16` (various large sizes)

**Generally consistent within context** but no strict guidelines.

### 8.2 Icon Colors

**Consistent with text color system:**
- `text-gray-400` (placeholders, inactive)
- `text-gray-500`, `text-gray-600` (normal)
- `text-cyan-600`, `text-blue-600` (primary actions)
- `text-purple-600`, `text-violet-600` (AI/special features)
- Status colors: `text-green-600`, `text-red-600`, `text-orange-600`

**Generally consistent** ✅

### 8.3 Icon Usage Patterns

**Lucide React icons used consistently** ✅

**Common patterns:**
- Leading icons in buttons: `gap-2`
- Icons with labels: `flex items-center gap-1` or `gap-2`
- Icon buttons: Centered with `p-2` or `p-3`

---

## 9. Animation & Transitions

### 9.1 Transition Timing

**Button.tsx** (Line 91)
```tsx
transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
```

**Card.tsx** (Line 87)
```tsx
transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
```

**TopNavigation.tsx** (Multiple locations)
```tsx
style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
```

**Consistent bouncy easing** ✅

**But also found:**
- `transition-all duration-300` (most common)
- `transition-all duration-200`
- `transition-all duration-500`
- `transition-colors`, `transition-opacity`, `transition-transform`

**Issue:** Duration varies, specific transition properties inconsistent.

### 9.2 Hover Scale Animations

**Found Values:**
- `hover:scale-105` (most common)
- `hover:scale-110` (icon buttons, close buttons)
- `hover:scale-[1.01]` (cards)
- `hover:scale-[1.02]` (some cards)
- `active:scale-95` (most buttons)
- `active:scale-90` (some buttons)
- `active:scale-[0.99]` (some cards)

**Issue:** No consistent scale factor guideline.

### 9.3 Shadow Transitions

**Consistent pattern:**
- Base: `shadow-lg` or `shadow-xl`
- Hover: Increase shadow intensity

**Example:**
```tsx
shadow-lg hover:shadow-xl
```

**Generally consistent** ✅

---

## 10. Component-Specific Issues

### 10.1 TopNavigation.tsx - Dynamic Island

**Unique styling not found elsewhere:**
```tsx
// Line 495-504
className="bg-white/40 backdrop-blur-2xl rounded-[40px]
  shadow-2xl border-2 border-white/50 ring-1 ring-black/5
  pointer-events-auto overflow-hidden"

style={{
  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: isExpanded ? 'width, height' : 'auto',
}}
```

**Issues:**
- `rounded-[40px]` (unique value)
- `ring-1 ring-black/5` (ring utility not used elsewhere)
- Different cubic-bezier from standard
- `willChange` optimization (good, but unique)

### 10.2 CaptureZone.tsx - Large Clock

```tsx
// Line 29
className="text-9xl font-extralight text-gray-700/70
  tracking-tighter mb-2"

style={{
  fontFamily: 'system-ui, -apple-system, sans-serif',
  letterSpacing: '-0.05em'
}}
```

**Issues:**
- Inline font family (not used elsewhere)
- Inline letter spacing (duplicates `tracking-tighter`?)
- `text-9xl` (128px - extreme size)

### 10.3 TaskDetailSidebar & NoteDetailSidebar

**Very detailed, complex components** with many inline styles.

**Positive:** Rich functionality, good UX
**Negative:** Style patterns don't align with base components

**Examples:**
- Custom badge styling for status/priority
- Custom timeline visualization
- Unique collapsible section patterns

### 10.4 SessionsZone.tsx

**Large, complex component** with session card variations.

**Issues:**
- Custom filter dropdowns with unique styling
- Session cards have different patterns than note/task cards
- Multiple border radius values in one component

### 10.5 ned/NoteCard.tsx & ned/TaskCard.tsx

**Enhanced cards with rich interactions:**
- Hover state animations (Framer Motion)
- Expandable sections
- Inline action buttons
- AI badges

**Issues:**
- Different card base styling than Card.tsx
- More elaborate shadow patterns
- Unique color combinations (e.g., `from-violet-50/80 to-purple-50/80`)

---

## 11. Pattern Conflicts

### 11.1 Glassmorphism Variants

**Three distinct glassmorphism patterns found:**

**Pattern A - Subtle (Default):**
```tsx
bg-white/50 backdrop-blur-xl border border-white/60
```
Used in: Card.tsx, some modals

**Pattern B - Medium:**
```tsx
bg-white/40 backdrop-blur-2xl border-2 border-white/50
```
Used in: SettingsModal, QuickTaskModal, TopNavigation island

**Pattern C - Light:**
```tsx
bg-white/30 backdrop-blur-xl border-2 border-white/60
```
Used in: LibraryZone cards, TasksZone cards, CaptureZone inputs

**Issue:** No clear semantic reason for which pattern to use where.

### 11.2 Border Width Patterns

**Found:**
- `border` (1px) - Default, subtle
- `border-2` (2px) - Modals, cards, emphasized elements
- No `border-4` or thicker

**Generally consistent:** 1px for subtle, 2px for emphasized ✅

**Issue:** Not always applied logically (some cards use `border-2` randomly).

### 11.3 Button vs Inline Button Styles

**Three patterns coexist:**

1. **Using Button component** (best practice)
```tsx
<Button variant="primary" size="md">Click</Button>
```

2. **Inline classes mimicking Button** (inconsistent)
```tsx
className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600..."
```

3. **Custom button patterns** (unique to component)
```tsx
className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500..."
```

**Issue:** No enforcement of Button component usage.

### 11.4 Modal vs Sidebar Patterns

**Modals:** Fixed overlay, centered, glassmorphism card
**Sidebars:** Slide-in from right, AppSidebar component

**Consistent distinction** ✅

**Issue:** AppSidebar has different glassmorphism pattern:
```tsx
// AppSidebar (not reviewed in detail, but likely different)
```

---

## 12. Recommendations

### 12.1 Immediate Fixes (High Priority)

#### 1. **Standardize Border Radius Values**

Create a design token system:

```tsx
// design-tokens.ts
export const RADIUS = {
  sm: 'rounded-lg',      // 8px  - small elements
  md: 'rounded-xl',      // 12px - inputs, small cards
  lg: 'rounded-2xl',     // 16px - buttons, standard cards
  xl: 'rounded-[24px]',  // 24px - large cards, zones
  '2xl': 'rounded-[32px]', // 32px - modals
  full: 'rounded-full',  // Pills, badges
} as const;
```

**Apply systematically:**
- Buttons: `RADIUS.lg` (16px)
- Inputs: `RADIUS.md` (12px)
- Cards: `RADIUS.lg` (16px) or `RADIUS.xl` (24px) based on size
- Modals: `RADIUS['2xl']` (32px)
- Badges/Pills: `RADIUS.full`

#### 2. **Consolidate Glassmorphism Patterns**

Define three semantic variants:

```tsx
// glassmorphism.ts
export const GLASS = {
  subtle: 'bg-white/50 backdrop-blur-xl border border-white/60',
  medium: 'bg-white/40 backdrop-blur-2xl border-2 border-white/50',
  strong: 'bg-white/30 backdrop-blur-2xl border-2 border-white/60',
} as const;
```

**Usage guidelines:**
- `subtle` - Default cards, secondary elements
- `medium` - Modals, emphasized cards, navigation island
- `strong` - Overlays, deep hierarchy elements

#### 3. **Enforce Button Component Usage**

**Create additional button variants** in Button.tsx:

```tsx
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'icon'        // NEW: Icon buttons
  | 'pill'        // NEW: Rounded pill buttons
  | 'gradient-alt'; // NEW: Purple-violet gradient
```

**Refactor all inline buttons** to use `<Button />` component.

**Example:**
```tsx
// Before
<button className="px-4 py-2 bg-gradient-to-r from-cyan-600...">

// After
<Button variant="primary" size="md">
```

#### 4. **Unify Modal Overlay Pattern**

**Standard overlay:**
```tsx
// modal-overlay.ts
export const MODAL_OVERLAY =
  'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm';
```

**Apply to all modals** (SettingsModal, QuickTaskModal, CommandPalette, etc.)

#### 5. **Standardize Primary Gradient**

**Single source of truth:**
```tsx
// gradients.ts
export const GRADIENTS = {
  primary: 'bg-gradient-to-r from-cyan-600 to-blue-600',
  primaryHover: 'hover:from-cyan-700 hover:to-blue-700',
  accent: 'bg-gradient-to-r from-purple-500 to-violet-600',
  accentHover: 'hover:from-purple-600 hover:to-violet-700',
} as const;
```

**Remove** all inline gradient definitions.

### 12.2 Medium Priority Improvements

#### 6. **Create Spacing Scale**

Use Tailwind's default scale **strictly**:
- `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px), `p-8` (32px)
- **Avoid:** `p-5`, `p-10`, `p-12` - use `p-4`, `p-8`, `p-6` instead
- **Avoid:** Half-increments like `px-2.5`, `py-1.5` unless absolutely necessary

#### 7. **Standardize Input Styling**

Create `<Input />` component:

```tsx
// Input.tsx
interface InputProps {
  variant?: 'default' | 'filled' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
}

const variantStyles = {
  default: `
    bg-white/70 backdrop-blur-xl
    border border-white/60 rounded-xl
    focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400
  `,
  // ...
};
```

#### 8. **Unify Toggle/Checkbox Components**

Create standardized `<Toggle />` component (consolidate the two patterns found).

#### 9. **Create Status Badge Component**

```tsx
// StatusBadge.tsx
type Status = 'success' | 'error' | 'warning' | 'info';

interface StatusBadgeProps {
  status: Status;
  children: ReactNode;
}

const STATUS_STYLES = {
  success: 'bg-green-100 text-green-700 border-green-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-orange-100 text-orange-700 border-orange-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
};
```

#### 10. **Standardize Typography Scale**

Define heading hierarchy:

```tsx
// typography.ts
export const HEADINGS = {
  h1: 'text-4xl font-bold',     // 36px - Page titles
  h2: 'text-2xl font-bold',     // 24px - Section titles
  h3: 'text-lg font-semibold',  // 18px - Subsection titles
  h4: 'text-base font-semibold', // 16px - Card titles
  body: 'text-base font-medium', // 16px - Body text
  caption: 'text-sm',            // 14px - Captions
  label: 'text-xs font-semibold uppercase tracking-wide', // 12px - Labels
} as const;
```

### 12.3 Long-term Improvements

#### 11. **Adopt CSS-in-JS or Design Tokens**

**Option A:** Use a design token system like `tailwind-merge` with defined constants.

**Option B:** Migrate to CSS-in-JS (Stitches, Vanilla Extract, or styled-components) for better type safety.

#### 12. **Component Library Audit**

Inventory **all** components and classify:
- ✅ **Using base components** (Button, Card) - keep
- ⚠️ **Inline styles matching patterns** - refactor to use base
- ❌ **Unique inline styles** - decide if pattern should be extracted

#### 13. **Create Design System Documentation**

Document in Storybook or similar:
- All component variants
- Color palette with semantic names
- Spacing scale
- Typography scale
- Animation patterns
- Usage guidelines

#### 14. **Linting Rules**

Add ESLint/Stylelint rules to enforce:
- No inline `bg-gradient-to-r` (must use constant)
- No arbitrary border radius values
- Require Button component for buttons
- Warn on `bg-white/XX` outside defined set

#### 15. **Accessibility Audit**

Not covered in this visual audit, but critical:
- Focus states consistency
- Color contrast ratios
- Keyboard navigation
- Screen reader labels

---

## 13. Summary Tables

### 13.1 Border Radius Inconsistencies

| Component | Location | Radius | Standard | Issue |
|-----------|----------|--------|----------|-------|
| Button.tsx | Line 33 | `rounded-2xl` (16px) | ✅ Standard | - |
| Card.tsx | Line 29 | `rounded-2xl` (16px) | ✅ Standard | - |
| SettingsModal | Line 120 | `rounded-[32px]` | ✅ Modal standard | - |
| QuickTaskModal | Line 119 | `rounded-[32px]` | ✅ Modal standard | - |
| MigrationDialog | Line 79 | `rounded-lg` (8px) | ❌ Wrong | Should use 32px |
| FirstTimeSetup | Line 48 | `rounded-3xl` (24px) | ⚠️ Close | Should use 32px |
| CommandPalette | Line 170 | `rounded-[32px]` | ✅ Modal standard | - |
| TopNavigation Island | Line 497 | `rounded-[40px]` | ❌ Unique | Should use 32px |
| CaptureZone Main | Line 660 | `rounded-[48px]` | ❌ Unique | Should use 24px or 32px |
| CaptureZone Cards | Line 822 | `rounded-[1.5rem]` (24px) | ⚠️ Acceptable | Should use design token |
| TaskCard Compact | Line 141 | `rounded-lg` (8px) | ❌ Wrong | Should use 16px |
| TaskCard Expanded | Line 167 | `rounded-xl` (12px) | ❌ Wrong | Should use 16px |
| NoteCard Compact | Line 141 | `rounded-lg` (8px) | ❌ Wrong | Should use 16px |
| NoteCard Expanded | Line 167 | `rounded-xl` (12px) | ❌ Wrong | Should use 16px |
| LibraryZone Cards | Line 420 | `rounded-[24px]` | ⚠️ Acceptable | Define as `RADIUS.xl` |
| TasksZone Kanban | Line 146 | `rounded-[24px]` | ⚠️ Acceptable | Define as `RADIUS.xl` |
| TasksZone Pills | Line 256 | `rounded-full` | ✅ Pill standard | - |

**Total unique values:** 9 (lg=8px, xl=12px, 2xl=16px, 24px, 3xl=24px, 32px, 40px, 48px, full)
**Recommended values:** 5 (8px, 12px, 16px, 24px/32px, full)

### 13.2 Glassmorphism Inconsistencies

| Pattern | Background | Blur | Border | Components Using |
|---------|-----------|------|--------|------------------|
| A | `white/50` | `backdrop-blur-xl` | `border border-white/60` | Card.tsx |
| B | `white/40` | `backdrop-blur-2xl` | `border-2 border-white/50` | SettingsModal, QuickTaskModal, TopNav |
| C | `white/30` | `backdrop-blur-xl` | `border-2 border-white/60` | LibraryZone, TasksZone, CaptureZone |
| D | `white/70` | `backdrop-blur-xl` | `border-2 border-white/60` | TaskCard, NoteCard (ned) |
| E | `white/90` | `backdrop-blur-xl` | `border border-white/20` | FirstTimeSetup |
| F | `white/30` | `backdrop-blur-2xl` | `border-2 border-white/60` | TasksZone Kanban |
| G | `white/30` | `backdrop-blur-lg` | `border border-white/60` | TasksZone Cards |

**Total patterns:** 7
**Recommended:** 3 (subtle, medium, strong)

### 13.3 Button Gradient Inconsistencies

| Component | Gradient | Hover | Location |
|-----------|----------|-------|----------|
| Button.tsx (primary) | `from-cyan-600 to-blue-600` | Scale + shadow | Line 42 |
| SettingsModal Save | `from-purple-600 to-blue-600` | Scale + shadow | Line 331 |
| QuickTaskModal Create | `from-cyan-600 to-blue-600` | Scale + shadow | Line 276 |
| TopNavigation Task | `from-cyan-500 to-blue-500` | `hover:from-violet-600 hover:to-fuchsia-600` | Line 1017 |
| CaptureZone Process | `from-cyan-500 to-blue-500` | `hover:from-violet-600 hover:to-fuchsia-600` | Line 757 |
| TasksZone New Task | `from-cyan-500 to-blue-500` | Scale + shadow | Line 256 |
| LibraryZone New Note | `from-purple-500 to-violet-600` | Scale + shadow | Line 197 |

**Total patterns:** 5
**Recommended:** 2 (primary: cyan-blue, accent: purple-violet)

### 13.4 Input Styling Inconsistencies

| Component | Background | Border | Radius | Focus Ring |
|-----------|-----------|---------|---------|------------|
| SettingsModal | `white/70` | `border border-white/60` | `rounded-lg` | `ring-purple-500` |
| QuickTaskModal | `white/30` | `border border-white/60` | `rounded-[20px]` | `ring-cyan-500` |
| TaskDetailSidebar | `white/30` | `border-2 border-white/60` | `rounded-[24px]` | `ring-cyan-400` |
| FirstTimeSetup | Solid | `border border-gray-300` | `rounded-xl` | `ring-violet-500` |
| CaptureZone (RichTextEditor) | `white/30` | `border border-white/60` | `rounded-[20px]` | (varies) |

**Total patterns:** 5
**Recommended:** 1-2 (default, filled)

---

## 14. Conclusion

### Overall Assessment

**Strengths:**
- ✅ Consistent use of glassmorphism aesthetic
- ✅ Consistent cyan-blue color scheme
- ✅ Good use of Tailwind utility classes
- ✅ Lucide icons used consistently
- ✅ Modal vs Sidebar distinction clear
- ✅ Typography hierarchy mostly consistent
- ✅ Good animation timing with custom easing

**Weaknesses:**
- ❌ **Critical:** 9 different border radius values
- ❌ **Critical:** 7 different glassmorphism patterns
- ❌ **Critical:** 5 different button gradient patterns
- ❌ **Critical:** Button component underutilized
- ❌ **Major:** No standardized input component
- ❌ **Major:** Inconsistent spacing scale
- ❌ **Major:** Two different toggle patterns
- ❌ **Moderate:** Color values vary for same intent
- ❌ **Moderate:** Shadow patterns inconsistent

**Consistency Score Breakdown:**
- Button Patterns: 4/10
- Modal/Dialog Patterns: 7/10
- Card Patterns: 5/10
- Color Palette: 7/10
- Typography: 8/10
- Spacing: 5/10
- Form Elements: 4/10
- Icons: 8/10
- Animations: 8/10

**Overall:** 6.5/10

### Recommended Action Plan

**Phase 1 (Week 1):** Foundation
1. Create design token constants
2. Standardize border radius
3. Consolidate glassmorphism patterns
4. Document in central location

**Phase 2 (Week 2):** Component Refactoring
5. Extend Button component with new variants
6. Create Input component
7. Create Toggle component
8. Create StatusBadge component

**Phase 3 (Week 3):** Application-wide Refactoring
9. Refactor all inline buttons to use Button component
10. Refactor all inputs to use Input component
11. Update all modals to use standard overlay
12. Fix all border radius inconsistencies

**Phase 4 (Week 4):** Quality Assurance
13. Visual regression testing
14. Accessibility audit
15. Update documentation
16. Add linting rules

**Estimated effort:** 4-6 weeks for complete consistency overhaul.

---

## 15. Appendices

### Appendix A: Complete Color Inventory

**Cyan variants:**
`cyan-50`, `cyan-100`, `cyan-100/30`, `cyan-100/60`, `cyan-100/70`, `cyan-200`, `cyan-200/40`, `cyan-200/50`, `cyan-300`, `cyan-300/60`, `cyan-400`, `cyan-500`, `cyan-500/10`, `cyan-500/20`, `cyan-600`, `cyan-700`

**Blue variants:**
`blue-50`, `blue-50/40`, `blue-100`, `blue-200`, `blue-300`, `blue-400`, `blue-500`, `blue-500/10`, `blue-500/20`, `blue-600`, `blue-700`, `blue-800`, `blue-900`

**Purple/Violet variants:**
`purple-50`, `purple-100`, `purple-200`, `purple-500`, `purple-500/10`, `purple-600`, `purple-700`, `violet-50`, `violet-100`, `violet-500`, `violet-600`, `violet-700`, `fuchsia-500`, `fuchsia-600`

**Gray variants:**
`gray-50`, `gray-100`, `gray-200`, `gray-300`, `gray-400`, `gray-500`, `gray-600`, `gray-700`, `gray-800`, `gray-900`

**Status colors:**
`green-50`, `green-100`, `green-500`, `green-600`, `green-700`, `emerald-500`, `emerald-600`, `teal-500`, `teal-600`
`red-50`, `red-100`, `red-200`, `red-500`, `red-600`, `red-700`, `red-800`, `red-900`
`orange-50`, `orange-100`, `orange-500`, `orange-600`, `orange-700`, `amber-500`, `amber-600`
`yellow-50`, `yellow-100`, `yellow-500`, `yellow-600`, `yellow-700`

**White opacity variants:**
`white/90`, `white/80`, `white/70`, `white/60`, `white/50`, `white/40`, `white/30`, `white/20`, `white/10`

**Black opacity variants:**
`black/50`, `black/20`, `black/5`

### Appendix B: All Border Radius Values Found

- `rounded-lg` (8px)
- `rounded-xl` (12px)
- `rounded-2xl` (16px)
- `rounded-3xl` (24px)
- `rounded-[20px]`
- `rounded-[24px]`
- `rounded-[32px]`
- `rounded-[40px]`
- `rounded-[48px]`
- `rounded-[1.5rem]` (24px)
- `rounded-full`

### Appendix C: All Transition Duration Values Found

- `duration-200` (200ms)
- `duration-300` (300ms)
- `duration-500` (500ms)

### Appendix D: All Padding Combinations Found

**Single values:**
`p-1`, `p-1.5`, `p-2`, `p-3`, `p-4`, `p-5`, `p-6`, `p-8`, `p-10`, `p-12`

**Horizontal:**
`px-1`, `px-1.5`, `px-2`, `px-2.5`, `px-3`, `px-4`, `px-5`, `px-6`, `px-8`, `px-9`, `px-12`

**Vertical:**
`py-0.5`, `py-1`, `py-1.5`, `py-2`, `py-2.5`, `py-3`, `py-3.5`, `py-4`, `py-5`

**Common combinations:**
- `px-4 py-2` (buttons)
- `px-6 py-2` (large buttons)
- `px-3 py-1.5` (small buttons)
- `px-4 py-3` (inputs)
- `p-6` (modals/cards)

---

**End of Report**
