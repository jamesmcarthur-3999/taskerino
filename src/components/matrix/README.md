# Matrix Animation System

Core infrastructure for Taskerino's canvas loading animation with tetris/assembly effects.

## Overview

The matrix animation system provides a foundation for creating "blocks falling into place" animations that visualize AI canvas generation. It consists of three main parts:

1. **MatrixCore.tsx** - SVG renderer with Framer Motion animations
2. **useMatrixAnimation.ts** - RAF-based animation hook (60fps)
3. **matrixPatterns.ts** - Pattern generators (tetris & sparkle)

## Quick Start

```tsx
import { MatrixCore, useMatrixAnimation } from '@/components/matrix';

function MyComponent() {
  const pattern = useMatrixAnimation({
    rows: 10,
    cols: 10,
    patternType: 'tetris',
    speed: 'medium',
    isActive: true,
  });

  return (
    <MatrixCore
      rows={10}
      cols={10}
      pattern={pattern}
      cellSize={20}
      cellGap={4}
    />
  );
}
```

## Components

### MatrixCore

SVG-based grid renderer that displays animated cells.

**Props:**

- `rows` (number) - Number of rows in the grid
- `cols` (number) - Number of columns in the grid
- `cellSize` (number, optional) - Size of each cell in pixels (default: 20)
- `cellGap` (number, optional) - Gap between cells in pixels (default: 4)
- `pattern` (MatrixPattern) - Current pattern to render
- `colors` (object, optional) - Custom color scheme
- `className` (string, optional) - Additional CSS classes

**Color Mapping:**

Cells are colored based on brightness value:
- brightness > 0.8 → primary color (cyan-600)
- brightness 0.5-0.8 → secondary color (blue-600)
- brightness 0.2-0.5 → accent color (purple-600)
- brightness < 0.2 → off color (gray-200)

**Animation:**

- Transition duration: 0.3s
- Easing: easeInOut
- Animates: opacity, scale, color
- Performance: Uses will-change hints and memoized positions

### useMatrixAnimation

Custom hook that drives pattern animation at 60fps.

**Props:**

- `rows` (number) - Number of rows
- `cols` (number) - Number of columns
- `patternType` (PatternType, optional) - 'tetris' | 'sparkle' (default: 'tetris')
- `speed` (AnimationSpeed, optional) - 'slow' | 'medium' | 'fast' (default: 'medium')
- `isActive` (boolean, optional) - Whether animation is running (default: true)

**Returns:** `MatrixPattern` object with current state

**Animation Speeds:**

- `slow`: 2000ms per cycle
- `medium`: 1500ms per cycle
- `fast`: 800ms per cycle

**Features:**

- Uses requestAnimationFrame for smooth 60fps
- Properly handles pause/resume with `isActive`
- Cleans up RAF on unmount (no memory leaks)
- Resets when pattern type or dimensions change

## Patterns

### Tetris Pattern

The primary pattern for canvas generation. Simulates blocks falling and assembling into place.

**Stages:**

1. **Initial (progress 0.0-0.3)**: Empty grid with occasional falling blocks at top
2. **Building (progress 0.3-0.9)**: Grid fills from bottom up, row by row
3. **Completion (progress 0.9-1.0)**: Full grid with pulsing brightness

**Visual Details:**

- Fills from bottom to top
- Checkerboard-like pattern with variation
- Frontier row shows "falling blocks" that blink
- Completion phase adds pulsing effect
- Random offsets create organic feel

### Sparkle Pattern

Simple fallback pattern for testing. Random cells light up and fade like stars.

**Features:**

- More sparkles as progress increases
- Pulsing effect on active cells
- Phase-shifted timing for variety

## Custom Patterns

You can create custom patterns by implementing the pattern signature:

```typescript
function myPattern(
  rows: number,
  cols: number,
  progress: number // 0-1
): MatrixPattern {
  const cells: MatrixCell[][] = [];

  for (let row = 0; row < rows; row++) {
    const rowCells: MatrixCell[] = [];
    for (let col = 0; col < cols; col++) {
      rowCells.push({
        row,
        col,
        brightness: yourLogicHere(row, col, progress),
      });
    }
    cells.push(rowCells);
  }

  return { cells, timestamp: Date.now() };
}
```

## Usage Examples

### Example 1: Basic Loading Animation

```tsx
function LoadingScreen() {
  const pattern = useMatrixAnimation({
    rows: 12,
    cols: 16,
    patternType: 'tetris',
    speed: 'medium',
    isActive: true,
  });

  return (
    <div className="flex items-center justify-center h-screen">
      <MatrixCore
        rows={12}
        cols={16}
        pattern={pattern}
      />
    </div>
  );
}
```

### Example 2: Custom Colors (Ocean Theme)

```tsx
function OceanMatrix() {
  const pattern = useMatrixAnimation({
    rows: 10,
    cols: 10,
    patternType: 'tetris',
    speed: 'fast',
    isActive: true,
  });

  return (
    <MatrixCore
      rows={10}
      cols={10}
      pattern={pattern}
      colors={{
        primary: '#0891b2',   // cyan-600
        secondary: '#2563eb', // blue-600
        accent: '#9333ea',    // purple-600
        off: '#e5e7eb',       // gray-200
      }}
    />
  );
}
```

### Example 3: Pause/Resume Control

```tsx
function ControlledMatrix() {
  const [isActive, setIsActive] = useState(true);

  const pattern = useMatrixAnimation({
    rows: 10,
    cols: 10,
    patternType: 'tetris',
    speed: 'medium',
    isActive,
  });

  return (
    <div>
      <MatrixCore rows={10} cols={10} pattern={pattern} />
      <button onClick={() => setIsActive(!isActive)}>
        {isActive ? 'Pause' : 'Resume'}
      </button>
    </div>
  );
}
```

### Example 4: With Glassmorphism

```tsx
import { getGlassClasses } from '@/design-system/theme';

function GlassMatrix() {
  const pattern = useMatrixAnimation({
    rows: 10,
    cols: 10,
    patternType: 'tetris',
    speed: 'medium',
    isActive: true,
  });

  return (
    <div className={`${getGlassClasses('strong')} rounded-[32px] p-8`}>
      <MatrixCore
        rows={10}
        cols={10}
        pattern={pattern}
        className="rounded-xl"
      />
    </div>
  );
}
```

## Performance Considerations

### Optimizations

1. **Memoized Cell Positions**: Cell positions are calculated once and cached
2. **RAF-based Updates**: Uses requestAnimationFrame for optimal frame timing
3. **Will-change Hints**: CSS hints for transform and opacity animations
4. **Proper Cleanup**: RAF is cancelled on unmount to prevent memory leaks
5. **Pattern Caching**: Pattern generation is fast (<5ms per frame)

### Best Practices

- Keep grid sizes reasonable (10x10 to 20x20 recommended)
- Use `isActive={false}` when animation is not visible
- Prefer `cellSize` of 16-24px for best visual results
- Use `cellGap` of 4-8px for clear cell separation

### Performance Metrics

- **Frame Rate**: Consistent 60fps on modern devices
- **Pattern Generation**: <5ms per frame
- **Memory**: Minimal footprint, proper cleanup
- **CPU**: Low impact, efficient RAF scheduling

## Architecture

```
matrix/
├── MatrixCore.tsx           - SVG renderer (150 lines)
├── useMatrixAnimation.ts    - Animation hook (100 lines)
├── matrixPatterns.ts        - Pattern generators (150 lines)
├── index.ts                 - Barrel exports
├── MatrixExample.tsx        - Usage examples
└── README.md                - This file
```

## Integration with AI Canvas

To integrate with the AI Canvas loading animation:

1. Import the matrix system
2. Trigger animation when canvas generation starts
3. Use `tetris` pattern with `speed: 'medium'`
4. Set `isActive` based on loading state
5. Display over canvas during generation
6. Fade out when generation completes

```tsx
function AICanvasLoader({ isGenerating }: { isGenerating: boolean }) {
  const pattern = useMatrixAnimation({
    rows: 16,
    cols: 20,
    patternType: 'tetris',
    speed: 'medium',
    isActive: isGenerating,
  });

  if (!isGenerating) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
      <div className={`${getGlassClasses('strong')} rounded-[32px] p-8`}>
        <MatrixCore
          rows={16}
          cols={20}
          pattern={pattern}
          cellSize={20}
          cellGap={6}
        />
        <p className="text-center mt-4 text-gray-700">
          Building your canvas...
        </p>
      </div>
    </div>
  );
}
```

## Types

### MatrixCell

```typescript
interface MatrixCell {
  row: number;
  col: number;
  brightness: number; // 0-1
}
```

### MatrixPattern

```typescript
interface MatrixPattern {
  cells: MatrixCell[][];
  timestamp: number;
}
```

### PatternType

```typescript
type PatternType = 'tetris' | 'sparkle';
```

### AnimationSpeed

```typescript
type AnimationSpeed = 'slow' | 'medium' | 'fast';
```

## Future Enhancements

Potential additions for the future:

- Wave pattern (ripple effect)
- Spiral pattern (center-out)
- Random fill pattern
- Custom pattern generator support
- Color transition animations
- Interactive patterns (mouse-responsive)
- Sound effects integration
- Progress callback API

## License

Part of Taskerino - Internal component library
