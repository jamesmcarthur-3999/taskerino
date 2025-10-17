# Engine Quick Reference

## Quick Start

```typescript
import { generateConfig } from './engine';

// Generate config from session data
const result = generateConfig(sessionData);

if (result.success) {
  const config = result.config;
  // Use config with MorphingCanvas
}
```

## Common Operations

### Register a Module

```typescript
import { ModuleRegistry } from './engine';

const registry = ModuleRegistry.getInstance();

registry.register('my-module', MyComponent, {
  displayName: 'My Module',
  category: 'content',
  variants: ['compact', 'standard'],
  requires: { screenshots: true },
});
```

### Select Layout

```typescript
import { LayoutEngine } from './engine';

const engine = new LayoutEngine();
const selection = engine.selectLayout(sessionData);

console.log(`Layout: ${selection.layoutType}`);
console.log(`Confidence: ${selection.confidence * 100}%`);
```

### Compose Modules

```typescript
const composition = engine.composeModules(
  'deep_work_dev',
  sessionData,
  { maxModules: 5 }
);

console.log(`Modules: ${composition.modules.length}`);
```

### Generate Complete Config

```typescript
import { generateConfig } from './engine';

const result = generateConfig(sessionData, {
  layoutType: 'deep_work_dev', // Optional override
  maxModules: 6,
  themeMode: 'dark',
  enableAnimations: true,
});

if (result.success) {
  // Use result.config
}
```

## Layout Types

- `deep_work_dev` - Code-heavy sessions
- `collaborative_meeting` - Meetings with decisions
- `learning_session` - Video/audio learning
- `creative_workshop` - Design and visuals
- `research_review` - Screenshots and documents
- `presentation` - Linear content flow
- `default` - General purpose

## Module Categories

- `media` - Video, audio, images
- `timeline` - Time-based navigation
- `content` - Text, code, documents
- `analytics` - Charts and metrics
- `navigation` - Filtering and search
- `interaction` - Interactive tools

## Module Variants

- `minimal` - Bare essentials only
- `compact` - Space-efficient view
- `standard` - Normal display (default)
- `expanded` - More detailed view
- `detailed` - Full information

## Search & Filter

```typescript
const registry = ModuleRegistry.getInstance();

// By category
const mediaModules = registry.getByCategory('media');

// By requirements
const videoModules = registry.getByRequirements({ video: true });

// By tags
const productivityModules = registry.searchByTags(['productivity']);

// By variant
const compactModules = registry.getByVariant('compact');
```

## Validation

```typescript
// Validate module config
const validation = registry.validateConfig('notes', {
  variant: 'compact',
});

if (!validation.valid) {
  console.error(validation.errors);
}

// Validate generated config
import { validateConfig } from './engine';

const result = validateConfig(config);
if (!result.valid) {
  console.error(result.errors);
}
```

## Responsive Behavior

```typescript
const engine = new LayoutEngine();

// Apply responsive adjustments
const mobileModules = engine.applyResponsive(modules, 'mobile');
const desktopModules = engine.applyResponsive(modules, 'desktop');
```

## Custom Layouts

```typescript
const engine = new LayoutEngine();

engine.registerLayout({
  layoutType: 'deep_work_dev',
  id: 'custom-dev',
  name: 'Custom Dev Layout',
  description: 'My custom layout',
  slots: {
    'main': { desktop: { column: '1 / 10', row: '1 / 4' } },
    'side': { desktop: { column: '10 / 13', row: '1 / 4' } },
  },
  gridConfig: { columns: 12, gap: '1rem' },
  recommendedModules: ['notes', 'tasks'],
});
```

## Error Handling

All operations return Result types:

```typescript
const result = registry.register(...);

if (result.success) {
  // Success - use result.data
} else {
  // Error - handle result.error
  console.error(result.error);
}
```

## Statistics

```typescript
const stats = registry.getStats();

console.log('Total modules:', stats.totalModules);
console.log('By category:', stats.modulesByCategory);
console.log('By type:', stats.modulesByType);
```

## One-Liners

```typescript
// Quick config generation
import { quickGenerateConfig } from './engine';
const config = quickGenerateConfig(sessionData);

// Get registry instance
import { getRegistry } from './engine';
const registry = getRegistry();

// Determine layout
import { determineLayoutType } from './engine';
const layoutType = determineLayoutType(sessionData);

// Analyze session
import { analyzeSessionData } from './engine';
const characteristics = analyzeSessionData(sessionData);
```

## Testing

```typescript
import { ModuleRegistry, LayoutEngine } from './engine';

describe('My Test', () => {
  beforeEach(() => {
    // Clear registry between tests
    ModuleRegistry.getInstance().clear();
  });

  it('should work', () => {
    const registry = ModuleRegistry.getInstance();
    registry.register('test', () => null, {
      displayName: 'Test',
      category: 'content',
    });

    expect(registry.has('test')).toBe(true);
  });
});
```

## Performance Tips

1. **Reuse instances** - Registry is singleton, use getInstance()
2. **Cache configs** - Don't regenerate on every render
3. **Validate once** - Validate during generation, not on use
4. **Batch operations** - Register multiple modules at once

## Common Patterns

### Pattern 1: Auto-Generate with Fallback

```typescript
const result = generateConfig(sessionData);
const config = result.success ? result.config : defaultConfig;
```

### Pattern 2: Manual Override

```typescript
const result = generateConfig(sessionData, {
  layoutType: userPreference.layout,
});
```

### Pattern 3: Hybrid Approach

```typescript
const auto = generateConfig(sessionData);
const config = {
  ...auto.config,
  modules: customModules, // Override modules
};
```

## Debugging

```typescript
// Enable logging
const result = generateConfig(sessionData);

console.log('Layout:', result.layoutSelection);
console.log('Confidence:', result.layoutSelection.confidence);
console.log('Reasoning:', result.layoutSelection.reasoning);
console.log('Modules:', result.moduleComposition.modules);
console.log('Warnings:', result.warnings);
```

## Import Paths

```typescript
// All-in-one
import {
  ModuleRegistry,
  LayoutEngine,
  generateConfig,
} from './engine';

// Individual files
import { ModuleRegistry } from './engine/registry';
import { LayoutEngine } from './engine/layout-engine';
import { generateConfig } from './engine/config-generator';
```

## Type Imports

```typescript
import type {
  LayoutType,
  ModuleVariant,
  SessionCharacteristics,
  LayoutSelectionResult,
} from './engine';
```
