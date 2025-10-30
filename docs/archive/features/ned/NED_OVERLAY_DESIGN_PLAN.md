# Ned Overlay - Global AI Assistant Design Plan

**Promotion: From Zone to Overlay**
Transforming Ned from a confined assistant zone into a globally-accessible, context-aware AI companion.

---

## 🎯 Design Philosophy

### Core Principles
1. **Always Accessible** - Ned should be available from any view, any time
2. **Non-Intrusive** - Overlay shouldn't block critical content
3. **Delightful Interactions** - Premium animations and micro-interactions
4. **Context-Aware** - Ned knows what you're working on
5. **Glassmorphic Beauty** - Matches Taskerino's visual language

### Vision Statement
*"Ned transforms from a destination you visit into a companion that's always by your side - floating elegantly above your workspace, ready to help without getting in the way."*

---

## 📐 Layout & Positioning

### Overlay Specifications

```
┌─────────────────────────────────────────────┐
│  [Logo]  [Nav Island]        [Notifications]│  ← Fixed Top Bar
│                                         [Ned]│  ← Ned Button
└─────────────────────────────────────────────┘
           ↓ (on click)
           ┌──────────────────────┐
           │  💬 Chat with Ned    │  ← Chat Header
           ├──────────────────────┤
           │                      │
           │   [Message Input]    │  ← Input at TOP
           │                      │
           ├──────────────────────┤
           │                      │
           │   Conversation       │
           │   History            │  ← Extends Down
           │   (scrollable)       │
           │        ↓             │
           │        ↓             │
           │                      │
           └──────────────────────┘
```

### Position Details
- **Anchor Point**: Right side of screen, aligned with navigation island
- **Offset**: 20px from right edge, 80px from top (below nav island)
- **Width**: 440px (comfortable reading width)
- **Max Height**: 75vh (prevents overwhelming the screen)
- **Border Radius**: 32px (harmonizes with navigation island's 40px)

### Responsive Behavior
- **Desktop (>1280px)**: Full 440px width, right-aligned
- **Laptop (1024-1280px)**: 400px width
- **Tablet (768-1024px)**: 380px width
- **Mobile (<768px)**: Full-screen takeover (like a modal)

---

## 🎨 Visual Design

### Glassmorphism Specifications

```css
/* Container Styles */
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(24px) saturate(180%);
border: 2px solid rgba(255, 255, 255, 0.7);
box-shadow:
  0 20px 40px rgba(6, 182, 212, 0.15),
  0 0 0 1px rgba(0, 0, 0, 0.05) inset,
  0 1px 2px rgba(255, 255, 255, 0.9) inset;
border-radius: 32px;
```

### Color Palette
- **Primary Gradient**: `from-cyan-500 to-blue-600` (Ned's identity)
- **Glass Background**: `rgba(255, 255, 255, 0.85)`
- **Border**: `rgba(255, 255, 255, 0.7)`
- **Shadow**: `rgba(6, 182, 212, 0.15)` (cyan tint)
- **Text**: `text-gray-900` (high contrast for readability)
- **Secondary Text**: `text-gray-600`

### Component Breakdown

#### 1. Ned Button (Navigation Island)
```tsx
Position: Top-right corner of navigation island
Size: 44px × 44px (comfortable tap target)
Icon: Sparkles ✨ or Robot emoji 🤖
States:
  - Default: bg-white/60, text-cyan-600
  - Hover: bg-white/80, scale-105, shadow-xl
  - Active: bg-gradient-to-r from-cyan-500 to-blue-600, text-white
  - Pulse: Animated ring when Ned has suggestions
```

#### 2. Chat Header
```tsx
Height: 72px
Background: bg-white/60 with gradient overlay
Content:
  - Ned Avatar (gradient circle with sparkle)
  - "Chat with Ned" title
  - Minimize and Close buttons
Border: border-b-2 border-white/40
```

#### 3. Input Section (TOP)
```tsx
Position: Directly below header
Background: bg-white/70
Height: Auto (min 56px, max 120px)
Content:
  - Textarea with auto-resize
  - Send button (gradient circle)
  - Clear conversation button (subtle, left side)
Border: border-b-2 border-white/40
Padding: p-4
```

#### 4. Conversation Area (SCROLLABLE)
```tsx
Flex: flex-1
Overflow: overflow-y-auto
Background: transparent
Padding: p-6
Scrollbar: Custom styled, minimal width
```

#### 5. Footer (Optional)
```tsx
Height: 48px
Background: bg-white/50
Content: Tips, keyboard shortcuts, status
Border: border-t-2 border-white/40
```

---

## ✨ Animation Specifications

### Entry Animation (When Opening)

```tsx
// Framer Motion Configuration
initial={{
  opacity: 0,
  scale: 0.92,
  y: -20,
  transformOrigin: "top right"
}}
animate={{
  opacity: 1,
  scale: 1,
  y: 0
}}
transition={{
  type: "spring",
  stiffness: 300,
  damping: 24,
  duration: 0.35
}}
```

**Visual Breakdown**:
1. **Frame 0ms**: Invisible, scaled to 92%, 20px above final position
2. **Frame 175ms**: 50% opacity, scale 96%, 10px above
3. **Frame 350ms**: Full opacity, scale 100%, final position
4. **Overshoot**: Slight bounce (spring effect)

### Exit Animation (When Closing)

```tsx
exit={{
  opacity: 0,
  scale: 0.9,
  y: -10,
  transformOrigin: "top right"
}}
transition={{
  duration: 0.2,
  ease: "easeInOut"
}}
```

**Faster exit** - Users don't wait for slow closing animations.

### Micro-interactions

#### 1. Ned Button Hover
```tsx
whileHover={{
  scale: 1.08,
  rotate: [0, -3, 3, 0],
  transition: { duration: 0.3 }
}}
```

#### 2. Ned Button Active (When Overlay Open)
```tsx
// Continuous subtle pulse
animate={{
  boxShadow: [
    "0 0 0 0 rgba(6, 182, 212, 0.4)",
    "0 0 0 8px rgba(6, 182, 212, 0)",
  ]
}}
transition={{
  duration: 1.5,
  repeat: Infinity
}}
```

#### 3. Send Button
```tsx
whileHover={{ scale: 1.1, rotate: 15 }}
whileTap={{ scale: 0.95 }}
transition={{ type: "spring", stiffness: 400 }}
```

#### 4. Message Appear Animation
```tsx
// Stagger children
staggerChildren: 0.05
```

Each message:
```tsx
initial={{ opacity: 0, y: 10, scale: 0.98 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
transition={{ type: "spring", damping: 20 }}
```

### Loading States

#### Thinking Indicator
```tsx
<motion.div
  animate={{
    scale: [1, 1.1, 1],
    opacity: [0.7, 1, 0.7]
  }}
  transition={{
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut"
  }}
>
  <Loader2 className="animate-spin" />
</motion.div>
```

#### Typing Dots
```tsx
{[0, 150, 300].map((delay, i) => (
  <motion.span
    key={i}
    animate={{ y: [0, -6, 0] }}
    transition={{
      duration: 0.6,
      repeat: Infinity,
      delay: delay / 1000
    }}
  />
))}
```

---

## 🔧 Technical Architecture

### Component Structure

```
src/components/ned/
├── NedOverlay.tsx           # Main overlay container (NEW)
├── NedButton.tsx            # Button in navigation island (NEW)
├── NedChat.tsx              # Existing - adapt layout
├── NedMessage.tsx           # Existing - no changes
├── TaskCard.tsx             # Existing - no changes
├── NoteCard.tsx             # Existing - no changes
├── SessionCard.tsx          # Existing - no changes
├── PermissionDialog.tsx     # Existing - adapt for overlay
└── NedSettings.tsx          # Existing - may need portal
```

### State Management

```typescript
// AppContext additions
interface UIState {
  // ... existing fields
  nedOverlay: {
    isOpen: boolean;
    minimized: boolean;  // Future: minimize to corner
  };
}

// New actions
type Action =
  | { type: 'TOGGLE_NED_OVERLAY' }
  | { type: 'OPEN_NED_OVERLAY' }
  | { type: 'CLOSE_NED_OVERLAY' }
  | { type: 'MINIMIZE_NED_OVERLAY' }
  | { type: 'RESTORE_NED_OVERLAY' }
  // ... existing actions
```

### Portal Rendering

```tsx
// NedOverlay.tsx
import { createPortal } from 'react-dom';

export const NedOverlay: React.FC = () => {
  const { state } = useApp();

  if (!state.ui.nedOverlay.isOpen) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      <NedOverlayContent />
    </AnimatePresence>,
    document.body
  );
};
```

**Why Portal?**
- Renders at root level (z-index freedom)
- Avoids stacking context issues
- Enables backdrop-blur to work properly
- Allows overlay to float above everything

### Z-Index Hierarchy

```typescript
const Z_INDEX = {
  NAVIGATION: 50,           // Navigation island
  NED_BACKDROP: 55,         // Semi-transparent backdrop
  NED_OVERLAY: 60,          // Ned chat overlay
  PERMISSION_DIALOG: 65,    // Permission requests
  TOAST: 70                 // Top-most notifications
};
```

### Keyboard Shortcuts

```typescript
// Global keyboard listener
useHotkeys('cmd+j', () => {
  dispatch({ type: 'TOGGLE_NED_OVERLAY' });
});

useHotkeys('escape', () => {
  if (state.ui.nedOverlay.isOpen) {
    dispatch({ type: 'CLOSE_NED_OVERLAY' });
  }
});
```

---

## 🎭 Interaction Patterns

### Opening Ned

**Triggers**:
1. Click Ned button in navigation
2. Press `⌘J` keyboard shortcut
3. Click "Ask Ned" from context menus (coming soon)

**Behavior**:
1. Dim background (backdrop-blur + opacity)
2. Animate overlay in from top-right
3. Auto-focus input field
4. Restore scroll position from previous session

### Using Ned

**Flow**:
1. Type message in input (at top)
2. Press Enter or click send
3. Input clears, message appears in conversation below
4. Ned thinks (loading animation)
5. Response streams in with tool calls shown
6. Cards appear for tasks/notes/sessions
7. Scroll to see full conversation history

**Input Behavior**:
- Enter: Send message
- Shift+Enter: New line
- Escape: Close overlay (with confirmation if active conversation)
- ⌘K: Clear conversation
- Auto-resize up to 120px height

### Closing Ned

**Triggers**:
1. Click X button in header
2. Press Escape
3. Click backdrop (outside overlay)

**Behavior**:
1. Confirmation if Ned is currently processing
2. Animate overlay out (faster than entry)
3. Remove backdrop
4. Restore focus to previous element
5. Conversation persists (not cleared)

### Context Awareness

**Ned knows**:
- Current tab you're on
- Selected tasks/notes
- Active session
- Last viewed item
- Recent searches

**Examples**:
- User on Tasks tab → Ned suggests "Want me to create a task for that?"
- User in session → Ned offers "Should I analyze your current session?"
- User viewing note → Ned can reference "Looking at your note about X..."

---

## 🎯 UX Enhancements

### 1. Smart Suggestions

Show contextual prompts when idle:
```tsx
// Example suggestions based on context
{
  tab: 'tasks',
  suggestions: [
    "Show my urgent tasks",
    "What's due this week?",
    "Create a task for..."
  ]
}
```

### 2. Minimized State (Future)

When minimized:
- Collapses to a small floating pill (like Picture-in-Picture)
- Shows "Ned is thinking..." status
- Click to restore full overlay
- Positioned at bottom-right corner

### 3. Quick Actions

Floating action buttons in conversation:
- 📌 Pin this answer
- 🔄 Regenerate response
- 📋 Copy to clipboard
- ✨ Continue this thought

### 4. Conversation History

- Persist in localStorage (with size limits)
- Clear conversation button (with confirmation)
- Export conversation as markdown
- Search within conversation

### 5. Voice Input (Future)

- Microphone button in input area
- Voice-to-text transcription
- Matches audio recording architecture
- "Hey Ned" wake word?

---

## 📱 Responsive Design

### Desktop (>1280px)
- Full 440px width overlay
- Right-aligned to navigation
- All features enabled

### Laptop (1024-1280px)
- 400px width
- Slightly smaller padding
- Full feature set

### Tablet (768-1024px)
- 380px width or 50% screen width (whichever smaller)
- May dock to right edge
- Consider slide-in from right animation

### Mobile (<768px)
- **Full-screen modal**
- Slides up from bottom
- Covers entire viewport
- Back button closes
- Different animation (slide up, not scale)

---

## 🚀 Implementation Plan

### Phase 1: Core Infrastructure (Day 1-2)
✅ **Goal**: Get basic overlay working

**Tasks**:
1. Create `NedButton.tsx` component
2. Add button to `TopNavigation.tsx`
3. Create `NedOverlay.tsx` with portal
4. Add state management (TOGGLE/OPEN/CLOSE actions)
5. Implement basic open/close animations
6. Add backdrop with blur effect
7. Set up z-index hierarchy

**Acceptance Criteria**:
- Click button opens overlay
- Overlay renders above all content
- Click backdrop closes overlay
- Escape key closes overlay
- Smooth animations in/out

### Phase 2: Layout Adaptation (Day 2-3)
✅ **Goal**: Adapt NedChat for new home

**Tasks**:
1. Refactor `NedChat.tsx` layout
2. Move input to top (below header)
3. Conversation area scrolls below input
4. Add custom header with minimize/close buttons
5. Adjust widths and spacing
6. Update color scheme for glass effect
7. Ensure mobile responsive layout

**Acceptance Criteria**:
- Input stays at top while scrolling
- Conversation scrolls independently
- Layout looks identical to mockups
- Works on all screen sizes
- Maintains existing functionality

### Phase 3: Animations & Polish (Day 3-4)
✨ **Goal**: Make it delightful

**Tasks**:
1. Add spring animations to overlay entry
2. Implement micro-interactions (hover, tap)
3. Add message stagger animations
4. Create loading states (thinking, typing)
5. Smooth scroll to new messages
6. Add subtle shadows and glows
7. Polish all transitions

**Acceptance Criteria**:
- Opening feels bouncy and alive
- All interactions have feedback
- No janky animations
- 60fps performance
- Matches navigation island quality

### Phase 4: Keyboard & Accessibility (Day 4-5)
♿ **Goal**: Make it accessible

**Tasks**:
1. Add `⌘J` shortcut to toggle
2. Implement escape key handling
3. Focus management (trap focus in overlay)
4. ARIA labels and roles
5. Keyboard navigation within conversation
6. Screen reader announcements
7. High contrast mode support

**Acceptance Criteria**:
- All features keyboard accessible
- Focus never trapped incorrectly
- Screen readers can navigate
- Shortcuts documented

### Phase 5: Context & Smart Features (Day 5-6)
🧠 **Goal**: Make Ned smarter

**Tasks**:
1. Pass current context to Ned
2. Show smart suggestions based on tab
3. "Ask Ned about this" context menu items
4. Conversation persistence
5. Clear conversation feature
6. Scroll restoration

**Acceptance Criteria**:
- Ned knows current context
- Suggestions are relevant
- Conversations persist across sessions
- Can clear and start fresh

### Phase 6: Testing & Refinement (Day 6-7)
🔍 **Goal**: Perfect the experience

**Tasks**:
1. Test on all screen sizes
2. Test with long conversations
3. Performance profiling
4. Fix edge cases
5. User feedback integration
6. Final polish pass
7. Documentation

**Acceptance Criteria**:
- No bugs in common workflows
- Smooth on all devices
- Fast and responsive
- Users love it

---

## 🎪 Wow Factors

### 1. Elastic Bounce Entry
The overlay should feel alive - not just fading in, but bouncing into place with spring physics that make it feel physical and delightful.

### 2. Contextual Awareness
Ned isn't just a chatbot - he knows where you are, what you're doing, and offers relevant help without being asked.

### 3. Seamless Integration
The glass effect, colors, and animations perfectly match the navigation island - like they were always meant to be together.

### 4. Input-First Design
Unlike traditional chat where you scroll past input, ours keeps it at the top - always ready, never hidden.

### 5. Performance
Buttery smooth 60fps animations, instant responses, optimized rendering - it never lags or stutters.

### 6. Smart Suggestions
When idle, Ned shows contextual suggestions based on what you're working on - proactive, not reactive.

---

## 📊 Success Metrics

### Quantitative
- **Usage**: Ned opened 10x more frequently vs. Assistant Zone
- **Response Time**: User input to visible response < 500ms
- **Animation Performance**: Consistent 60fps during animations
- **Accessibility**: 100% keyboard navigable, WCAG AA compliant

### Qualitative
- **Delight**: Users use words like "smooth", "beautiful", "love it"
- **Usefulness**: Ned becomes their go-to for quick actions
- **Discoverable**: New users find Ned button immediately
- **Natural**: Feels like a native part of Taskerino

---

## 🎨 Visual Mockup ASCII

```
┌─────────────────────────────────────────────────────────┐
│  [T] Taskerino      [Capture][Tasks][Library]...        │
│                                              [🔔][👤][✨]│ ← Ned Button
└─────────────────────────────────────────────────────────┘
                                                    ↓ Click
                                        ┌──────────────────┐
                                        │  ✨ Chat with Ned│
                                        ├──────────────────┤
                                        │ ┌──────────────┐ │
                                        │ │ Ask Ned...   │ │ ← Input TOP
                                        │ │              │ │
                                        │ └──────────────┘ │
                                        ├──────────────────┤
                                        │                  │
                                        │  User: Show my   │
                                        │  urgent tasks    │
                                        │                  │
                                        │  Ned: I found 3  │
                                        │  urgent tasks:   │
                                        │  ┌────────────┐  │
                                        │  │ Task Card  │  │
                                        │  └────────────┘  │
                                        │  ┌────────────┐  │
                                        │  │ Task Card  │  │
                                        │  └────────────┘  │
                                        │  ┌────────────┐  │
                                        │  │ Task Card  │  │
                                        │  └────────────┘  │
                                        │        ↓         │ ← Scrolls
                                        └──────────────────┘
```

---

## 🔮 Future Enhancements

### Phase 2 Features (Post-Launch)
1. **Minimized State** - Collapse to floating pill
2. **Voice Input** - "Hey Ned" wake word
3. **Conversation Branching** - Fork conversations
4. **Smart Attachments** - Drag & drop files/images
5. **Quick Reply Buttons** - One-tap responses
6. **Ned Suggestions** - Proactive notifications
7. **Multi-conversation** - Switch between topics
8. **Export/Share** - Share conversation as link

### Experimental Ideas
- **Ned Everywhere** - Right-click context menu "Ask Ned about this"
- **Ned Shortcuts** - Type `/ned` in any input to invoke
- **Ned Memory** - Remembers preferences across sessions
- **Ned Plugins** - Third-party tool integrations

---

## 📝 Notes & Considerations

### Performance
- Use `React.memo` for message components
- Virtualize long conversation lists (react-window)
- Debounce input auto-resize
- Lazy load tool result cards
- Optimize backdrop-blur rendering

### Accessibility
- Trap focus when overlay open
- Announce state changes to screen readers
- Support reduced motion preferences
- High contrast mode support
- Keyboard shortcuts documented

### Edge Cases
- What if conversation is very long? (Virtualization)
- What if user spams send? (Rate limiting)
- What if API is slow? (Timeout, retry)
- What if Ned errors out? (Graceful error states)
- What if user has no API key? (Clear CTA to add one)

### Browser Compatibility
- Test Safari backdrop-blur performance
- Ensure Firefox animations are smooth
- Check Edge glassmorphism rendering
- Mobile browser variations

---

## 🎯 Conclusion

This design transforms Ned from a hidden assistant into a **first-class citizen** of Taskerino. By making Ned globally accessible, beautifully animated, and context-aware, we create an experience that users will love and use constantly.

The key is in the details: the spring physics, the glassmorphism, the smart suggestions, the seamless integration with the navigation island. Every interaction should feel polished, purposeful, and delightful.

**Let's make Ned the best AI assistant interface you've ever used.**

---

*Ready to implement? Let's start with Phase 1! 🚀*
