# Contributing to Taskerino

Thank you for your interest in contributing to Taskerino! This guide will help you get set up and understand the codebase.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Architecture Overview](#architecture-overview)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Make sure you have these installed before starting:

**Required:**
- [Node.js 18+](https://nodejs.org/) and npm
- [Rust toolchain](https://rustup.rs/) (for Tauri)
- Claude API key from [console.anthropic.com](https://console.anthropic.com/)

**Optional (for full features):**
- OpenAI API key (for audio review features)
- macOS 10.15+ (for video recording via ScreenCaptureKit)

**Platform-specific:**
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: webkit2gtk, libappindicator ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))
- **Windows**: Microsoft Visual Studio C++ Build Tools

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone git@github.com:jamesmcarthur-3999/taskerino.git
   cd taskerino
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run tauri:dev
   ```

   This starts both the Vite dev server and the Tauri desktop app.

4. **Configure API keys:**
   - Launch the app
   - Navigate to Profile Zone (bottom-right icon)
   - Enter your Claude API key
   - (Optional) Enter OpenAI API key for session features

### Alternative: Web-Only Mode

For quick frontend-only development (no native features):

```bash
npm run dev
# Open http://localhost:5173
```

**Note:** Many features (video recording, native storage, screen capture) won't work in web mode.

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev                 # Vite dev server only (web mode)
npm run tauri:dev           # Full Tauri app with hot reload

# Building
npm run build               # Build frontend only
npm run tauri:build         # Build production Tauri app

# Code Quality
npm run type-check          # TypeScript type checking
npm run lint                # ESLint
npm test                    # Run all tests
npm run test:ui             # Test UI (recommended for development)
npm run test:coverage       # Run tests with coverage

# Testing Specific Files
npx vitest run path/to/file.test.ts
npx vitest watch path/to/file.test.ts
```

### Development Tips

1. **Hot Reload**: Both the frontend (Vite) and Tauri backend support hot reload in dev mode
2. **Rust Changes**: Rust code changes trigger automatic recompilation
3. **Console Logs**: Check both browser console (for frontend) and terminal (for Tauri backend)
4. **React DevTools**: Use for inspecting component state and context values

## Architecture Overview

### App Structure

Taskerino is a **Tauri v2 desktop app** with a React frontend. Here's what you need to know:

#### 6 Main Zones

1. **Capture Zone** - Universal input for quick note capture
2. **Tasks Zone** - Task management with multiple views
3. **Library Zone** - Organized notes by topic
4. **Sessions Zone** - Work session recording and review
5. **Assistant Zone** - Chat with Ned, the AI assistant
6. **Profile Zone** - Settings and configuration

#### Two Navigation Systems

1. **Top Navigation Island** (`src/components/TopNavigation/`)
   - Fixed navigation bar with dynamic expansion
   - Mode-specific interfaces (Search, Task, Note, etc.)
   - Spring-based animations

2. **Space Sub-Menus** (MenuMorphPill + SpaceMenuBar)
   - Scroll-driven morphing menus within zones
   - GPU-accelerated animations
   - See `src/components/MenuMorphPill.tsx` and `SpaceMenuBar.tsx`

#### Context Architecture (Migration In Progress)

The app is migrating from monolithic `AppContext` to specialized contexts:

**New Specialized Contexts (Preferred):**
- `SettingsContext` - User settings and AI configuration
- `UIContext` - UI state, preferences
- `NotesContext` - Note CRUD
- `TasksContext` - Task CRUD
- `SessionsContext` - Session lifecycle
- `EnrichmentContext` - AI enrichment pipeline
- `EntitiesContext` - Companies, contacts, topics
- `ThemeContext` - Theme management
- `CanvasNavigationContext` - Canvas navigation

**Legacy Context (Being Deprecated):**
- `AppContext` - **DO NOT extend this!** Use specialized contexts instead

**Important:** When adding features, use the specialized contexts. See `CLAUDE.md` for details.

#### Storage System (Dual-Adapter Pattern)

The app uses different storage backends depending on the environment:

- **Desktop (Tauri)**: `TauriFileSystemAdapter` - Native file system (unlimited storage)
- **Browser**: `IndexedDBAdapter` - IndexedDB (limited to ~100s MB)

**Usage:**
```typescript
import { getStorage } from './services/storage';
import { attachmentStorage } from './services/attachmentStorage';

// For JSON data
const storage = await getStorage();
await storage.saveSessions([...]);

// For binary attachments (images, audio, video)
const attachment = await attachmentStorage.createAttachment({...});
```

#### AI Services

Multiple AI services handle different tasks:

- `claudeService.ts` - Core processing (Sonnet 4.5 & Haiku 4.5)
- `sessionEnrichmentService.ts` - Session AI analysis
- `contextAgent.ts` - Information retrieval
- `sessionsAgentService.ts` - Session insights
- `videoChapteringService.ts` - Video analysis
- `nedService.ts` - Ned AI assistant
- `openAIService.ts` - GPT-4o audio review

### Key Technologies

- **Frontend**: React 19, TypeScript, Vite
- **Desktop**: Tauri v2 (Rust backend)
- **Styling**: Tailwind CSS, Framer Motion
- **AI**: Claude Sonnet 4.5, Haiku 4.5, GPT-4o
- **Rich Text**: Tiptap
- **Storage**: IndexedDB (browser) / File System (desktop)

## Code Style Guidelines

### TypeScript

- Use strict TypeScript - no `any` unless absolutely necessary
- Define types in `src/types.ts` or co-located with components
- Use interface over type for object shapes
- Always type function parameters and return values

### React Components

- Use functional components with hooks
- Prefer named exports for components
- Keep components focused and single-purpose
- Extract complex logic into custom hooks

**Example:**
```typescript
interface MyComponentProps {
  title: string;
  onSave: (data: MyData) => void;
}

export function MyComponent({ title, onSave }: MyComponentProps) {
  // Component logic
}
```

### Context Usage

When working with contexts:

```typescript
// ✅ Good - Use specialized contexts
import { useNotes } from './context/NotesContext';
import { useTasks } from './context/TasksContext';

function MyComponent() {
  const { notes, addNote } = useNotes();
  const { tasks, addTask } = useTasks();
  // ...
}

// ❌ Bad - Don't extend AppContext
import { useApp } from './context/AppContext';
```

### Styling

- Use Tailwind utility classes
- Import design tokens from `design-system/theme.ts`
- Use `getGlassClasses()`, `getRadiusClass()` utilities
- Avoid inline styles unless dynamic

**Example:**
```typescript
import { NAVIGATION, getGlassClasses } from './design-system/theme';

<div className={`${getGlassClasses()} ${NAVIGATION.TAB_BASE}`}>
  {/* Content */}
</div>
```

### Animations

- Use Framer Motion for complex animations
- Import from centralized animation system: `src/animations/` or `src/lib/animations/`
- Use `useReducedMotion` hook for accessibility

**Example:**
```typescript
import { motion } from 'framer-motion';
import { fadeIn } from './animations/variants';
import { useReducedMotion } from './animations/hooks';

export function AnimatedComponent() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={reducedMotion ? undefined : fadeIn}
      initial="initial"
      animate="animate"
    >
      Content
    </motion.div>
  );
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Interactive UI mode (recommended)
npm run test:ui

# With coverage
npm run test:coverage

# Specific file
npx vitest run src/context/SessionsContext.test.tsx

# Watch mode
npx vitest watch src/context/SessionsContext.test.tsx
```

### Writing Tests

We use Vitest + React Testing Library:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Coverage Requirements

Current thresholds (see `vitest.config.ts`):
- Lines: 30%
- Functions: 30%
- Branches: 25%
- Statements: 30%

Focus on testing **critical paths**: session lifecycle, enrichment pipeline, storage adapters.

## Common Tasks

### Adding a New Feature

1. **Determine the zone** - Which zone does this feature belong to?
2. **Choose the right context** - Use specialized contexts, not AppContext
3. **Create components** - Follow naming conventions
4. **Add types** - Define TypeScript interfaces
5. **Write tests** - Cover critical functionality
6. **Update CLAUDE.md** - Document architecture changes

### Adding a New AI Service

1. **Create service file** in `src/services/`
2. **Import API client:**
   ```typescript
   import { invoke } from '@tauri-apps/api/core';
   // Or use existing claudeService/openAIService
   ```
3. **Handle API keys** - Check for keys before calling
4. **Error handling** - Always handle API errors gracefully
5. **Cost tracking** - For expensive operations, track costs

### Adding a New Context

1. **Create context file** in `src/context/`
2. **Define types** and initial state
3. **Use reducer pattern** for complex state
4. **Export custom hook** (e.g., `useMyFeature`)
5. **Add to provider tree** in `App.tsx`
6. **Update CLAUDE.md** documentation

### Working with Tauri Commands

**Frontend (TypeScript):**
```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<string>('my_rust_command', {
  param: 'value'
});
```

**Backend (Rust):**
```rust
// In src-tauri/src/main.rs or separate module
#[tauri::command]
fn my_rust_command(param: String) -> Result<String, String> {
    Ok(format!("Received: {}", param))
}

// Register in main.rs:
.invoke_handler(tauri::generate_handler![my_rust_command])
```

### Updating Dependencies

```bash
# Frontend dependencies
npm update

# Check for outdated packages
npm outdated

# Rust dependencies
cd src-tauri
cargo update
```

## Troubleshooting

### Build Errors

**Tauri build fails:**
```bash
# Clean and rebuild
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

**Node modules issues:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Development Issues

**Hot reload not working:**
- Check that both Vite and Tauri dev servers are running
- Restart `npm run tauri:dev`
- Check console for errors

**TypeScript errors:**
```bash
npm run type-check
```

**Tests failing:**
```bash
# Run specific test file to see detailed errors
npx vitest run path/to/failing/test.ts --reporter=verbose
```

### macOS-Specific Issues

**Screen recording permission denied:**
1. System Settings → Privacy & Security → Screen Recording
2. Add your terminal app and/or Taskerino

**Activity monitoring not working:**
1. System Settings → Privacy & Security → Accessibility
2. Add your terminal app and/or Taskerino

### API Issues

**Claude API errors:**
- Verify API key in Profile Zone settings
- Check Anthropic account has credits
- Review console logs for specific error messages

**OpenAI audio review fails:**
- Verify OpenAI API key is configured
- Check audio file format (should be WAV)
- Review enrichment status for error details

### Performance Issues

**App running slowly:**
- Check number of sessions/notes/tasks
- Use export function to archive old data
- Monitor browser/Tauri console for memory leaks

**Large attachments:**
- Screenshots are automatically compressed
- Consider reducing screenshot capture frequency
- Use video chaptering instead of high-frequency screenshots

## Additional Resources

- **CLAUDE.md** - Detailed architecture documentation
- **README.md** - User-facing documentation
- [Tauri Documentation](https://v2.tauri.app/)
- [React Documentation](https://react.dev/)
- [Framer Motion](https://www.framer.com/motion/)

## Getting Help

- Check existing issues on GitHub
- Review CLAUDE.md for architecture details
- Look at similar components for patterns
- Ask questions in pull requests

## Submitting Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the guidelines above

3. **Test your changes:**
   ```bash
   npm run type-check
   npm test
   npm run tauri:dev  # Manual testing
   ```

4. **Commit with descriptive messages:**
   ```bash
   git add .
   git commit -m "Add feature: description of what you did"
   ```

5. **Push and create a pull request:**
   ```bash
   git push origin feature/your-feature-name
   ```

Thank you for contributing to Taskerino!
