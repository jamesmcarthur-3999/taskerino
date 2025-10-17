# Morphing Canvas Engine

The engine is the core intelligence system for the Morphing Canvas. It handles module registration, layout selection, and configuration generation.

## Architecture Overview

```
engine/
├── registry.ts         - Module registration and retrieval
├── layout-engine.ts    - Layout selection and module composition
├── config-generator.ts - Configuration generation from session data
└── index.ts           - Main exports
```

## Core Components

### 1. ModuleRegistry

Singleton registry for managing all available modules.

**Key Methods:**
- `register(type, component, definition)` - Register a new module type
- `get(type)` - Get a registered module
- `getAll()` - Get all registered modules
- `getByCategory(category)` - Filter modules by category
- `getByRequirements(requirements)` - Find modules matching content requirements

**Example:**
```typescript
import { ModuleRegistry } from './engine';

const registry = ModuleRegistry.getInstance();

registry.register('my-module', MyComponent, {
  displayName: 'My Module',
  category: 'content',
  variants: ['compact', 'standard', 'expanded'],
  defaultVariant: 'standard',
  requires: {
    screenshots: true,
  },
});
```

### 2. LayoutEngine

Intelligent layout selection and module composition engine.

**Key Methods:**
- `selectLayout(sessionData)` - Analyzes session and selects best layout
- `composeModules(layoutType, sessionData, options)` - Compose modules for a layout
- `calculateSlots(layoutType)` - Get available slots for a layout
- `applyResponsive(config, breakpoint)` - Apply responsive adjustments
- `registerLayout(template)` - Register a custom layout template

**Example:**
```typescript
import { LayoutEngine } from './engine';

const engine = new LayoutEngine();

// Select layout based on session data
const layoutResult = engine.selectLayout(sessionData);
console.log(`Selected: ${layoutResult.layoutType} (${layoutResult.confidence * 100}% confidence)`);

// Compose modules for the layout
const composition = engine.composeModules(
  layoutResult.layoutType,
  sessionData,
  {
    maxModules: 5,
    preferredVariant: 'compact',
  }
);
```

### 3. ConfigGenerator

High-level configuration generation from session data.

**Key Functions:**
- `generateConfig(sessionData, options)` - Main entry point for config generation
- `analyzeSessionData(sessionData)` - Extract session characteristics
- `determineLayoutType(sessionData)` - Simple heuristic-based layout selection
- `selectModulesForSession(sessionData)` - Select appropriate modules
- `validateConfig(config)` - Validate a generated configuration

**Example:**
```typescript
import { generateConfig } from './engine';

const result = generateConfig(sessionData, {
  layoutType: 'deep_work_dev', // Optional override
  maxModules: 6,
  defaultVariant: 'standard',
  enableAnimations: true,
});

if (result.success) {
  console.log('Configuration generated successfully');
  console.log('Layout:', result.config.layout.name);
  console.log('Modules:', result.config.modules.length);
} else {
  console.error('Generation failed:', result.error);
}
```

## Layout Selection Heuristics

The engine uses intelligent heuristics to select layouts:

1. **Deep Work Dev** - Triggered by:
   - Session has significant code changes (>10)
   - High confidence: 90%

2. **Learning Session** - Triggered by:
   - Session has video chapters (>3)
   - High confidence: 85%

3. **Collaborative Meeting** - Triggered by:
   - Session has decisions AND multiple participants
   - High confidence: 80%

4. **Research Review** - Triggered by:
   - Session has many screenshots (>20)
   - Medium confidence: 75%

5. **Creative Workshop** - Triggered by:
   - Session has screenshots AND notes
   - Medium confidence: 70%

6. **Default** - Fallback layout
   - Used when no specific patterns detected
   - Low confidence: 50%

## Layout Types

Available layout types:
- `deep_work_dev` - Code-heavy development sessions
- `collaborative_meeting` - Discussion and decision-heavy meetings
- `learning_session` - Educational content with media
- `creative_workshop` - Design and visual content
- `research_review` - Document and screenshot heavy
- `presentation` - Linear content flow
- `default` - General purpose fallback

## Module Categories

Modules are organized into categories:
- `media` - Video, audio, images
- `timeline` - Time-based navigation
- `content` - Text, code, documents
- `analytics` - Charts, metrics, insights
- `navigation` - Navigation and filtering
- `interaction` - Interactive tools

## Module Variants

Modules can support different visual variants:
- `minimal` - Bare essentials
- `compact` - Space-efficient
- `standard` - Normal display
- `expanded` - More detail
- `detailed` - Full information

## Responsive Behavior

The engine handles responsive adjustments automatically:

**Breakpoints:**
- `mobile` - Single column, 0.5rem gap
- `tablet` - 2 columns, 1rem gap
- `desktop` - 12 columns, 1.5rem gap
- `wide` - 12 columns, 1.5rem gap

**Adjustments:**
- Hide modules on smaller screens
- Switch to compact variants
- Reorder modules for better mobile UX

## Error Handling

All engine methods return structured results:

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

Always check the `success` field before using the data:

```typescript
const result = registry.register(type, component, definition);

if (!result.success) {
  console.error('Registration failed:', result.error);
  return;
}

// Proceed with success case
```

## Best Practices

1. **Use the singleton registry**
   - Don't create multiple registry instances
   - Use `ModuleRegistry.getInstance()` or `getRegistry()`

2. **Register modules early**
   - Register all modules during app initialization
   - Modules must be registered before config generation

3. **Leverage heuristics**
   - Let the engine select layouts automatically
   - Override only when necessary

4. **Validate configurations**
   - Always validate generated configs before use
   - Check for warnings and errors

5. **Handle errors gracefully**
   - Check result.success before using data
   - Provide fallbacks for failed operations

## Extension Points

### Custom Layout Templates

Register custom layouts with the engine:

```typescript
engine.registerLayout({
  layoutType: 'my-custom-layout',
  id: 'custom',
  name: 'Custom Layout',
  description: 'My custom layout template',
  slots: {
    'main': { desktop: { column: '1 / 13', row: '1 / 3' } },
  },
  gridConfig: { columns: 12, gap: '1rem' },
  recommendedModules: ['notes', 'tasks'],
  priority: 5,
});
```

### Custom Heuristics

Extend the layout engine with custom heuristics by subclassing:

```typescript
class CustomLayoutEngine extends LayoutEngine {
  protected initializeHeuristics() {
    return [
      ...super.initializeHeuristics(),
      {
        name: 'My Custom Rule',
        description: 'Custom selection logic',
        condition: (c) => c.customField === true,
        suggestedLayout: 'my-custom-layout',
        confidence: 0.95,
        priority: 15,
      },
    ];
  }
}
```

## Testing

The engine is designed to be testable:

```typescript
import { ModuleRegistry, LayoutEngine, generateConfig } from './engine';

describe('Engine', () => {
  beforeEach(() => {
    // Clear registry between tests
    ModuleRegistry.getInstance().clear();
  });

  it('should generate config for code-heavy session', () => {
    const sessionData = {
      userId: 'test',
      codeChanges: Array(15).fill({}),
    };

    const result = generateConfig(sessionData);
    expect(result.success).toBe(true);
    expect(result.layoutSelection.layoutType).toBe('deep_work_dev');
  });
});
```

## Performance Considerations

- Registry lookups are O(1) - Map-based
- Layout selection is O(n) where n = number of heuristics (typically <10)
- Module composition is O(m) where m = number of modules
- Overall config generation is fast enough for real-time use

## Future Enhancements

Potential areas for improvement:
- Machine learning-based layout selection
- User preference learning over time
- A/B testing support for layouts
- Performance monitoring and analytics
- Undo/redo support for configurations
