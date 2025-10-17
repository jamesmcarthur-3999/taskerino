# Animation Library

A reusable animation utilities library extracted from the Morphing Canvas. Provides FLIP animations, motion variants, stagger effects, and accessibility features for React applications using Framer Motion.

## Features

- **FLIP Animations**: Smooth layout transitions using First, Last, Invert, Play technique
- **Motion Variants**: Pre-configured animation variants (fade, slide, scale, bounce)
- **Stagger Effects**: Create sequential animations for lists and groups
- **Accessibility**: Respect user motion preferences automatically
- **TypeScript**: Fully typed with comprehensive interfaces

## Installation

This library requires Framer Motion as a peer dependency:

```bash
npm install framer-motion
```

## Usage

### Basic Animation Variants

```tsx
import { motion } from 'framer-motion';
import { fadeInVariants, slideUpVariants } from '@/lib/animations';

function MyComponent() {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      Content
    </motion.div>
  );
}
```

### FLIP Animations

```tsx
import { performFLIPTransition } from '@/lib/animations';

async function animateLayoutChange(element: HTMLElement) {
  await performFLIPTransition(element, () => {
    // Make DOM changes here
    element.style.width = '500px';
  });
}
```

### Stagger Animations

```tsx
import { motion } from 'framer-motion';
import { createListStaggerVariants } from '@/lib/animations';

const listVariants = createListStaggerVariants(5);

function List() {
  return (
    <motion.ul variants={listVariants.container} initial="hidden" animate="visible">
      {items.map(item => (
        <motion.li key={item.id} variants={listVariants.item}>
          {item.text}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### Accessibility

```tsx
import { useReducedMotion, getMotionSafeVariant } from '@/lib/animations';
import { bounceInVariants } from '@/lib/animations';

function AccessibleAnimation() {
  const reducedMotion = useReducedMotion();
  const variants = getMotionSafeVariant(bounceInVariants, reducedMotion);

  return (
    <motion.div variants={variants} initial="hidden" animate="visible">
      Content
    </motion.div>
  );
}
```

### Custom Transitions

```tsx
import { springPresets, easingPresets, durationPresets } from '@/lib/animations';

const customTransition = {
  ...springPresets.bouncy,
  duration: durationPresets.slow,
};
```

## API Reference

### Types

- `FLIPState` - FLIP animation state tracking
- `StaggerConfig` - Stagger animation configuration
- `AnimationTransition` - Transition configuration options

### Presets

- `springPresets` - Spring physics configurations (gentle, bouncy, snappy, smooth)
- `easingPresets` - Easing curve definitions (easeOut, easeIn, easeInOut, sharp, bouncy)
- `durationPresets` - Duration values in seconds (instant, fast, normal, slow, slower)

### FLIP Functions

- `calculateFLIP(element, firstRect)` - Calculate FLIP state
- `applyFLIPAnimation(element, flipState, transition)` - Apply FLIP animation
- `performFLIPTransition(element, callback, transition)` - High-level FLIP helper

### Variants

- `fadeInVariants` - Fade in/out
- `slideUpVariants` - Slide from bottom
- `scaleUpVariants` - Scale from center
- `slideInRightVariants` - Slide from right
- `slideInLeftVariants` - Slide from left
- `bounceInVariants` - Bounce in with spring
- `moduleAnimationVariants` - Map of all variants

### Stagger Functions

- `createStaggerVariants(config)` - Create stagger configuration
- `createListStaggerVariants(itemCount, baseDelay, staggerDelay)` - List stagger variants
- `getStaggerDelay(index, baseDelay, staggerDelay)` - Calculate delay for item

### Accessibility Functions

- `useReducedMotion()` - React hook for motion preference
- `shouldReduceMotion()` - Synchronous motion check
- `getMotionSafeVariant(variant, reducedMotion)` - Get safe variant

## Extracted From

This library was extracted from the Morphing Canvas implementation in Phase 2 of the AI Canvas project. It contains battle-tested animation utilities used in production.

## License

Same as parent project.
