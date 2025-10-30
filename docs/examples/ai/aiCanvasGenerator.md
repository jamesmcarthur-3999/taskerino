# AI Canvas Generator Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates how to use the AI Canvas Generator service to create dynamic, AI-personalized session review layouts. The service analyzes session data and generates a custom canvas specification with theme, layout, and metadata.

## Use Case

Use the AI Canvas Generator when you need to:
- Create personalized session review experiences based on session content
- Generate intelligent layout recommendations for the Morphing Canvas system
- Infer session mood and select appropriate color themes
- Provide fallback layouts when AI services are unavailable

## Example Code

```typescript
/**
 * Example test/usage of AICanvasGenerator
 * This demonstrates how to use the service with a mock session
 */

import { aiCanvasGenerator } from './aiCanvasGenerator';
import type { Session } from '../types';

// Mock session data
const mockSession: Session = {
  id: 'session-123',
  name: 'Building AI Canvas Feature',
  category: 'Development',
  startTime: '2025-10-17T09:00:00.000Z',
  endTime: '2025-10-17T12:30:00.000Z',
  screenshots: [
    { id: 'ss1', timestamp: '2025-10-17T09:15:00.000Z', path: '/path/1.png' },
    { id: 'ss2', timestamp: '2025-10-17T10:00:00.000Z', path: '/path/2.png' },
    { id: 'ss3', timestamp: '2025-10-17T11:30:00.000Z', path: '/path/3.png' },
  ],
  audioSegments: [
    { id: 'a1', timestamp: '2025-10-17T09:00:00.000Z', duration: 1800, path: '/audio/1.mp3' },
  ],
  summary: {
    narrative: 'Successfully implemented the AI Canvas Generator service with Claude integration. Built type-safe interfaces and robust fallback handling.',
    achievements: [
      'Created comprehensive type definitions for CanvasSpec',
      'Implemented Claude API integration',
      'Added intelligent session analysis',
      'Built fallback system for reliability',
    ],
    blockers: [
      'Need to validate JSON parsing edge cases',
    ],
    keyInsights: [
      'Session mood inference enhances personalization',
      'Fallback spec ensures graceful degradation',
    ],
    tags: ['ai', 'canvas', 'claude', 'typescript'],
  },
};

// Example usage
async function testCanvasGenerator() {
  console.log('Testing AI Canvas Generator...\n');

  try {
    const canvasSpec = await aiCanvasGenerator.generate(mockSession);

    console.log('Generated Canvas Spec:');
    console.log('======================\n');
    console.log('Theme:');
    console.log(`  Primary: ${canvasSpec.theme.primary}`);
    console.log(`  Secondary: ${canvasSpec.theme.secondary}`);
    console.log(`  Mood: ${canvasSpec.theme.mood}`);
    console.log(`  Explanation: ${canvasSpec.theme.explanation}\n`);

    console.log('Layout:');
    console.log(`  Type: ${canvasSpec.layout.type}`);
    console.log(`  Emphasis: ${canvasSpec.layout.emphasis}`);
    console.log(`  Sections: ${canvasSpec.layout.sections.length}`);
    canvasSpec.layout.sections.forEach(section => {
      console.log(`    - ${section.type} (${section.emphasis} emphasis, position ${section.position})`);
    });

    console.log('\nMetadata:');
    console.log(`  Session Type: ${canvasSpec.metadata.sessionType}`);
    console.log(`  Confidence: ${canvasSpec.metadata.confidence}`);
    console.log(`  Generated At: ${canvasSpec.metadata.generatedAt}`);

    return canvasSpec;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Export for use in other tests
export { testCanvasGenerator, mockSession };
```

## Expected Output

### When Claude API is available:
```
Generated Canvas Spec:
======================

Theme:
  Primary: #10b981
  Secondary: #3b82f6
  Mood: productive
  Explanation: Green represents growth and achievement, blue adds trust and stability

Layout:
  Type: story
  Emphasis: achievement-focused
  Sections: 4
    - hero (high emphasis, position 1)
    - achievements (high emphasis, position 2)
    - timeline (medium emphasis, position 3)
    - insights (medium emphasis, position 4)

Metadata:
  Session Type: coding
  Confidence: 0.85
  Generated At: 2025-10-17T...
```

### Fallback (when Claude API fails):
```
Theme:
  Primary: #3b82f6
  Secondary: #8b5cf6
  Mood: calm
  Explanation: Default

Layout:
  Type: timeline
  Emphasis: chronological
  Sections: 2
    - hero (high emphasis, position 1)
    - timeline (medium emphasis, position 2)

Metadata:
  Session Type: coding
  Confidence: 0.3
  Generated At: 2025-10-17T...
```

## Key Points

- **AI-Powered Personalization**: Uses Claude to analyze session content and generate intelligent layout recommendations
- **Mood Inference**: Automatically infers session mood (productive, calm, challenging, etc.) from achievements, blockers, and narrative
- **Robust Fallback System**: Always provides a valid canvas specification, even when AI services fail
- **Type Safety**: Returns strongly-typed CanvasSpec with theme, layout, and metadata
- **Session Analysis**: Considers screenshots, audio, summary, achievements, and blockers for comprehensive analysis
- **Low Confidence Indicator**: Fallback specs have confidence < 0.5 to signal reduced accuracy

## Related Documentation

- Main Service: `/src/services/aiCanvasGenerator.ts`
- Type Definitions: `/src/types.ts` (CanvasSpec, Session types)
- Morphing Canvas: `/src/components/morphing-canvas/`
- Claude Service: `/src/services/claudeService.ts`
