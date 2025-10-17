# Engine Integration Guide

This document explains how the engine system integrates with the existing morphing canvas infrastructure.

## Architecture Overview

The morphing canvas system now has two layers:

### Layer 1: Core Infrastructure (Existing)
- `/types/` - Base type definitions
- `/registry/moduleRegistry.ts` - Simple module registration
- `/layouts/defaultLayouts.ts` - Static layout templates
- `/modules/` - Module components

### Layer 2: Intelligence Engine (New)
- `/engine/registry.ts` - Enhanced registry with metadata and search
- `/engine/layout-engine.ts` - Intelligent layout selection
- `/engine/config-generator.ts` - Automatic configuration generation

## How They Work Together

### Basic Usage (Existing Flow)

```typescript
// 1. Register modules
import { registerModule } from './registry/moduleRegistry';

registerModule({
  type: 'notes',
  component: NotesModule,
  displayName: 'Notes',
});

// 2. Use a layout
import { dashboardLayout } from './layouts/defaultLayouts';

const config = {
  layout: dashboardLayout,
  modules: [
    { id: 'notes-1', type: 'notes', slotId: 'notes' },
  ],
};
```

### Enhanced Usage (With Engine)

```typescript
// 1. Register modules with enhanced metadata
import { ModuleRegistry } from './engine';

const registry = ModuleRegistry.getInstance();

registry.register('notes', NotesModule, {
  displayName: 'Notes',
  category: 'content',
  variants: ['compact', 'standard', 'expanded'],
  defaultVariant: 'standard',
  requires: { notes: true },
});

// 2. Auto-generate configuration from session data
import { generateConfig } from './engine';

const sessionData = {
  userId: 'user-123',
  notes: [...],
  tasks: [...],
};

const result = generateConfig(sessionData);

if (result.success) {
  // Use the auto-generated config
  const config = result.config;
}
```

## Migration Strategy

The engine is designed to be non-breaking. You can:

1. **Keep using the existing system** - It still works fine
2. **Gradually adopt the engine** - Use it for specific features
3. **Fully migrate** - Use the engine for all configuration

### Option 1: Keep Existing System

No changes needed. The engine is optional.

### Option 2: Gradual Adoption

Use the engine for auto-generation while keeping manual configs:

```typescript
// Auto-generate for new sessions
const autoConfig = generateConfig(sessionData);

// Manually configure for specific cases
const manualConfig = {
  layout: focusLayout,
  modules: [...],
};

// Choose based on context
const config = userPreference.autoGenerate ? autoConfig.config : manualConfig;
```

### Option 3: Full Migration

Replace all manual configuration with engine-based generation:

```typescript
// Before
import { dashboardLayout } from './layouts/defaultLayouts';
const config = {
  layout: dashboardLayout,
  modules: manuallyConfiguredModules,
};

// After
import { generateConfig } from './engine';
const result = generateConfig(sessionData);
const config = result.config;
```

## Bridging the Two Systems

### Converting Between Registries

The engine's ModuleRegistry can work alongside the existing registry:

```typescript
import { registerModule as registerSimple } from './registry/moduleRegistry';
import { registerModule as registerEnhanced } from './engine';

// Register in both systems
function registerModuleBoth(type, component, definition) {
  // Simple registry
  registerSimple({
    type,
    component,
    displayName: definition.displayName,
  });

  // Enhanced registry
  registerEnhanced(type, component, definition);
}
```

### Using Engine Layouts with Existing Code

The engine's layouts are compatible with the existing layout system:

```typescript
import { LayoutEngine } from './engine';

const engine = new LayoutEngine();
const layoutTemplate = engine.getLayout('deep_work_dev');

// Use with existing MorphingCanvas component
<MorphingCanvas config={{ layout: layoutTemplate, ... }} />
```

## Key Differences

### Simple Registry vs Enhanced Registry

**Simple Registry** (`/registry/moduleRegistry.ts`):
- Lightweight, Map-based storage
- Basic CRUD operations
- No metadata or intelligence
- Good for simple use cases

**Enhanced Registry** (`/engine/registry.ts`):
- Singleton pattern
- Rich metadata (variants, categories, requirements)
- Advanced search and filtering
- Validation and error handling
- Good for complex, intelligent systems

### Static Layouts vs Intelligent Layouts

**Static Layouts** (`/layouts/defaultLayouts.ts`):
- Pre-defined templates
- Manual selection
- Responsive grid definitions
- Good for predictable UIs

**Intelligent Layouts** (`/engine/layout-engine.ts`):
- Dynamic selection based on content
- Heuristic-based recommendations
- Automatic module composition
- Good for adaptive UIs

## Best Practices

### When to Use Simple System
- Fixed, predictable layouts
- Manual control over module placement
- Simple applications with few modules
- No need for auto-generation

### When to Use Engine
- Dynamic content-driven layouts
- Many possible layout variations
- Auto-configuration from session data
- Need for intelligent recommendations

### Using Both Together

You can use both systems together effectively:

```typescript
// Use simple registry for basic modules
import { registerModule } from './registry/moduleRegistry';
registerModule({ type: 'clock', component: ClockModule });

// Use engine for complex, content-aware modules
import { ModuleRegistry } from './engine';
const registry = ModuleRegistry.getInstance();
registry.register('timeline', TimelineModule, {
  category: 'timeline',
  requires: { video: true, audio: true },
  variants: ['compact', 'standard', 'expanded'],
});

// Mix static and dynamic layouts
const layouts = {
  // Static layouts for standard cases
  standard: dashboardLayout,
  focus: focusLayout,

  // Dynamic layouts for session-based cases
  session: generateConfig(sessionData).config.layout,
};
```

## Performance Considerations

### Simple System
- Very fast - direct Map lookups
- Minimal overhead
- No computation needed

### Engine System
- Slightly slower due to analysis
- Still fast enough for real-time use
- Can be cached for repeated use

**Recommendation**: Use simple system for static UIs, engine for dynamic UIs.

## Future Compatibility

The engine is designed to evolve alongside the simple system:

1. **Backward Compatible** - Existing code continues to work
2. **Incremental Adoption** - Use engine features as needed
3. **Migration Path** - Clear path to full engine usage if desired

## Examples

### Example 1: Basic App (Simple System)

```typescript
import { registerModules } from './registry/moduleRegistry';
import { dashboardLayout } from './layouts/defaultLayouts';

registerModules([
  { type: 'clock', component: ClockModule },
  { type: 'notes', component: NotesModule },
]);

const config = {
  layout: dashboardLayout,
  modules: [
    { id: 'clock-1', type: 'clock', slotId: 'clock' },
    { id: 'notes-1', type: 'notes', slotId: 'notes' },
  ],
};
```

### Example 2: Session-Based App (Engine)

```typescript
import { generateConfig } from './engine';
import { ModuleRegistry } from './engine';

// Setup
const registry = ModuleRegistry.getInstance();
registry.register('timeline', TimelineModule, {
  category: 'timeline',
  requires: { video: true },
});

// Usage
const sessionData = await fetchSessionData();
const result = generateConfig(sessionData, {
  maxModules: 6,
  enableAnimations: true,
});

const config = result.config;
```

### Example 3: Hybrid Approach

```typescript
import { generateConfig, LayoutEngine } from './engine';
import { focusLayout } from './layouts/defaultLayouts';

// Let engine choose modules, but use static layout
const engine = new LayoutEngine();
const layoutSelection = engine.selectLayout(sessionData);

const config = {
  // Use static layout
  layout: layoutSelection.layoutType === 'default'
    ? focusLayout
    : engine.getLayout(layoutSelection.layoutType),

  // Let engine compose modules
  modules: engine.composeModules(
    layoutSelection.layoutType,
    sessionData
  ).modules,
};
```

## Troubleshooting

### Issue: Module not found in engine

**Solution**: Register module in both systems or use simple system only.

### Issue: Layout selection not working

**Solution**: Ensure session data has the fields the engine expects.

### Issue: Performance slow

**Solution**: Cache generated configs or use simple system for static UIs.

## Summary

- **Simple System**: Fast, predictable, manual control
- **Engine System**: Intelligent, adaptive, automatic
- **Best Practice**: Use the right tool for the job
- **Integration**: Both systems work together seamlessly
