# Input Component

A standardized, fully-featured input component with glass morphism styling and theme support for the Taskerino design system.

## File Location
`/Users/jamesmcarthur/Documents/taskerino/src/components/Input.tsx`

## Features

### Core Features
- **Design System Integration**: Uses `getInputClasses()`, `RADIUS.field`, `SHADOWS.input`, and `TRANSITIONS.fast` from the design system
- **Dynamic Theming**: Integrates with `useTheme()` hook for automatic theme color application
- **Glass Morphism**: Beautiful frosted glass effect with proper backdrop blur
- **Full TypeScript Support**: Extends `React.InputHTMLAttributes<HTMLInputElement>` for complete type safety
- **Forward Ref Support**: Can be used with React refs for form libraries like React Hook Form

### Visual Features
- **Focus Ring**: Dynamic focus ring using theme colors
- **Error State**: Red border and text for validation errors
- **Disabled State**: Reduced opacity with cursor-not-allowed
- **Icon Support**: Optional left and right icons with proper spacing
- **Helper Text**: Optional gray helper text below input
- **Label Support**: Optional label above input

### Variants
1. **Default**: Standard input with optional icons
2. **Search**: Automatic search icon on the left
3. **Password**: Show/hide password toggle button on the right

## Props Interface

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;              // Optional label above input
  error?: string;              // Error message (displays below, red text)
  helperText?: string;         // Helper text (displays below, gray text)
  leftIcon?: React.ReactNode;  // Custom icon on the left
  rightIcon?: React.ReactNode; // Custom icon on the right
  variant?: 'default' | 'search' | 'password'; // Input variant
}
```

## Usage Examples

### 1. Basic Input
```tsx
import { Input } from './components/Input';

<Input placeholder="Enter your name" />
```

### 2. With Label and Helper Text
```tsx
<Input
  label="Email Address"
  placeholder="you@example.com"
  helperText="We'll never share your email with anyone"
  type="email"
/>
```

### 3. With Error State
```tsx
<Input
  label="Username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  error="This username is already taken"
/>
```

### 4. Search Variant
```tsx
<Input
  variant="search"
  placeholder="Search for anything..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

### 5. Password Variant (with show/hide toggle)
```tsx
<Input
  variant="password"
  label="Password"
  placeholder="Enter your password"
  helperText="Must be at least 8 characters"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
```

### 6. With Custom Icons
```tsx
import { Mail, Check } from 'lucide-react';

<Input
  label="Email"
  placeholder="you@example.com"
  leftIcon={<Mail className="w-5 h-5 text-gray-500" />}
  rightIcon={<Check className="w-5 h-5 text-green-500" />}
/>
```

### 7. Disabled State
```tsx
<Input
  label="Disabled Field"
  value="Cannot edit this"
  disabled
/>
```

### 8. In a Login Form
```tsx
import { Mail, Lock } from 'lucide-react';

<form onSubmit={handleSubmit}>
  <Input
    type="email"
    label="Email"
    placeholder="Enter your email"
    leftIcon={<Mail className="w-5 h-5 text-gray-500" />}
    required
    onChange={handleEmailChange}
  />

  <Input
    variant="password"
    label="Password"
    placeholder="Enter your password"
    leftIcon={<Lock className="w-5 h-5 text-gray-500" />}
    required
    onChange={handlePasswordChange}
  />

  <button type="submit">Login</button>
</form>
```

### 9. With React Hook Form
```tsx
import { useForm } from 'react-hook-form';

const { register, handleSubmit, formState: { errors } } = useForm();

<Input
  {...register('email', {
    required: 'Email is required',
    pattern: {
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      message: 'Invalid email address'
    }
  })}
  label="Email"
  placeholder="you@example.com"
  error={errors.email?.message}
/>
```

### 10. Different Input Types
```tsx
// Date
<Input type="date" label="Date of Birth" />

// Number
<Input type="number" label="Age" min={0} max={120} />

// URL
<Input type="url" label="Website" placeholder="https://example.com" />

// Tel
<Input type="tel" label="Phone" placeholder="+1 (555) 000-0000" />
```

## Styling Details

### Glass Morphism
The component uses `getInputClasses()` which applies:
- White background with opacity
- Backdrop blur for frosted glass effect
- Border with semi-transparent white
- Shadow for depth
- Theme-based focus ring colors

### Spacing
- **Padding**: `py-2.5` vertical, `px-4` horizontal (or `pl-11`/`pr-11` with icons)
- **Icon Position**: Absolute positioned at `left-3` or `right-3`
- **Label Margin**: `space-y-1` between label and input
- **Helper/Error Margin**: Displays below input with appropriate spacing

### Typography
- **Input Text**: `text-gray-900`
- **Placeholder**: `placeholder:text-gray-500`
- **Label**: `text-sm font-medium text-gray-700`
- **Error**: `text-sm text-red-600`
- **Helper**: `text-xs text-gray-500`

### States
- **Focus**: Theme-colored ring with 2px width
- **Error**: Red border and red focus ring
- **Disabled**: 50% opacity, cursor-not-allowed
- **Hover** (password toggle): Text color darkens

## Design System Constants Used

- `RADIUS.field`: Rounded corners (20px)
- `SHADOWS.input`: Shadow-sm for subtle depth
- `TRANSITIONS.fast`: 200ms transitions
- `getInputClasses()`: Complete glass morphism styling
- `getFocusRingClasses()`: Theme-based focus rings

## Theme Integration

The component automatically adapts to the current theme:
```tsx
const { colorScheme } = useTheme();
// colorScheme can be: 'ocean' | 'sunset' | 'forest' | 'lavender' | 'monochrome'
```

Focus rings and hover states will match the active color scheme.

## Accessibility

- Proper label association
- Error messages linked to input
- Disabled state properly handled
- Focus indicators visible
- Password toggle button has proper tabIndex (-1) and type="button"

## Browser Support

Works in all modern browsers that support:
- CSS backdrop-filter (for glass morphism)
- CSS Grid/Flexbox
- ES6+ JavaScript

## Examples File

See comprehensive examples in:
`/Users/jamesmcarthur/Documents/taskerino/src/components/Input.example.tsx`

This includes examples for:
- All variants
- Form integration
- Validation states
- Custom styling
- Icon combinations
- And more!
