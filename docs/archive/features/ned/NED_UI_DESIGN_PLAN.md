# 🎨 Ned Chat UI Redesign Plan

## 📐 Design System Analysis

**Taskerino's Design Language:**
- **Primary Colors:** Cyan/Blue gradients (`from-cyan-600 to-blue-600`)
- **Style:** Glassmorphism with `backdrop-blur-xl`
- **Borders:** `rounded-2xl` (16px) everywhere
- **Shadows:** Cyan-tinted (`shadow-cyan-200/40`)
- **Animations:** Bounce easing `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Hover Effects:** `scale-[1.02]`, `hover:shadow-xl`, `translate-y-1`
- **Cards:** `bg-white/70 backdrop-blur-2xl border-2 border-white/60`
- **Gradient Overlays:** `from-cyan-500/5 via-transparent to-blue-500/5`
- **No Dark Mode** (rest of app is light-only)

---

## 🎯 Quick Reference: What Needs Changing

### Colors
- Change purple/pink → cyan/blue throughout
- Remove all dark mode classes
- Match cyan-tinted shadows

### Components
1. AssistantZone: Change gradient background
2. Message bubbles: Glassmorphic user messages, cyan gradient
3. Cards: Match kanban card style from TasksZone
4. Buttons: Use Button component variants
5. Tool indicators: Match ProcessingIndicator
6. Input: Glassmorphic with cyan focus
7. Avatars: Cyan gradients

### Animations
- All hover: scale-[1.02] with bounce easing
- Entry: stagger with slide+fade
- Loading: smooth transitions
- Interactions: bounce on click

---

## 📋 Component Checklist

- [ ] AssistantZone background gradient
- [ ] User message bubbles (cyan gradient)
- [ ] Assistant message bubbles (glassmorphic)
- [ ] Task cards compact mode
- [ ] Note cards compact mode
- [ ] Tool use indicators
- [ ] Loading states
- [ ] Input area + send button
- [ ] Avatars (user + Ned)
- [ ] Permission dialog
- [ ] Error states
- [ ] Welcome screen
- [ ] Animations (entry, hover, loading)

---

## 🎨 Color Palette

**Primary Gradient:**
```
from-cyan-600 to-blue-600
```

**Background:**
```
from-cyan-50 via-blue-50/30 to-cyan-50
```

**Cards:**
```
bg-white/70 backdrop-blur-xl
border-2 border-white/60
```

**Shadows:**
```
shadow-lg shadow-cyan-200/50
```

**Focus:**
```
focus:border-cyan-400/80
focus:shadow-xl focus:shadow-cyan-200/40
```

---

*Design plan created: 2025-01-10*
*To be implemented after core intelligence improvements*
