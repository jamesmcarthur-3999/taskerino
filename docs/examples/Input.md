# Input Component Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates the Input component, a reusable form input with support for labels, icons, helper text, errors, search/password variants, and various input types.

## Use Case

Use the Input component when you need:
- Form inputs with consistent styling across the app
- Labels, helper text, and error messages
- Left/right icon support for visual context
- Search variant with search icon
- Password variant with show/hide toggle
- Validation states (error highlighting)
- Custom input types (email, url, number, date, etc.)
- Disabled and read-only states

## Example Code

```typescript
/**
 * Input Component - Usage Examples
 *
 * This file demonstrates all the features and variants of the Input component.
 */

import React, { useState } from 'react';
import { Input } from './Input';
import { Mail, User, Lock, Phone, CreditCard, Calendar } from 'lucide-react';

export function InputExamples() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [username, setUsername] = useState('invalid-user');
  const [phone, setPhone] = useState('');

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Input Component Examples</h1>

      {/* Basic Input */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Basic Input</h2>
        <Input
          placeholder="Enter your name"
          label="Full Name"
        />
      </section>

      {/* With Helper Text */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">With Helper Text</h2>
        <Input
          type="email"
          placeholder="you@example.com"
          label="Email Address"
          helperText="We'll never share your email with anyone else."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </section>

      {/* With Error */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">With Error State</h2>
        <Input
          placeholder="Enter username"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error="This username is already taken"
        />
      </section>

      {/* Search Variant */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Search Variant</h2>
        <Input
          variant="search"
          placeholder="Search for anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </section>

      {/* Password Variant */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Password Variant</h2>
        <Input
          variant="password"
          placeholder="Enter your password"
          label="Password"
          helperText="Must be at least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </section>

      {/* With Left Icon */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">With Left Icon</h2>
        <Input
          type="email"
          placeholder="you@example.com"
          label="Email"
          leftIcon={<Mail className="w-5 h-5 text-gray-500" />}
        />
      </section>

      {/* With Right Icon */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">With Right Icon</h2>
        <Input
          placeholder="Enter username"
          label="Username"
          rightIcon={<User className="w-5 h-5 text-green-500" />}
        />
      </section>

      {/* With Both Icons */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">With Both Icons</h2>
        <Input
          type="tel"
          placeholder="+1 (555) 000-0000"
          label="Phone Number"
          leftIcon={<Phone className="w-5 h-5 text-gray-500" />}
          rightIcon={
            <span className="text-xs font-medium text-gray-500">US</span>
          }
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </section>

      {/* Disabled State */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Disabled State</h2>
        <Input
          placeholder="This field is disabled"
          label="Disabled Input"
          disabled
          value="Cannot edit this"
        />
      </section>

      {/* Login Form Example */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Login Form Example</h2>
        <div className="space-y-4">
          <Input
            type="email"
            placeholder="Enter your email"
            label="Email"
            leftIcon={<Mail className="w-5 h-5 text-gray-500" />}
            required
          />
          <Input
            variant="password"
            placeholder="Enter your password"
            label="Password"
            leftIcon={<Lock className="w-5 h-5 text-gray-500" />}
            required
          />
        </div>
      </section>

      {/* Payment Form Example */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Payment Form Example</h2>
        <div className="space-y-4">
          <Input
            placeholder="1234 5678 9012 3456"
            label="Card Number"
            leftIcon={<CreditCard className="w-5 h-5 text-gray-500" />}
            helperText="Enter your 16-digit card number"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="MM/YY"
              label="Expiry Date"
              leftIcon={<Calendar className="w-5 h-5 text-gray-500" />}
            />
            <Input
              type="password"
              placeholder="CVV"
              label="Security Code"
              maxLength={3}
            />
          </div>
        </div>
      </section>

      {/* Different Input Types */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Different Input Types</h2>
        <div className="space-y-4">
          <Input
            type="date"
            label="Date of Birth"
          />
          <Input
            type="number"
            placeholder="0"
            label="Age"
            min={0}
            max={120}
          />
          <Input
            type="url"
            placeholder="https://example.com"
            label="Website"
            helperText="Enter a valid URL"
          />
        </div>
      </section>
    </div>
  );
}
```

## Quick Usage Examples

### 1. Basic Usage
```tsx
<Input placeholder="Enter text" />
```

### 2. With Label and Helper
```tsx
<Input
  label="Email"
  placeholder="you@example.com"
  helperText="We'll never share your email"
/>
```

### 3. With Error
```tsx
<Input
  label="Username"
  error="This username is taken"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
/>
```

### 4. Search Variant
```tsx
<Input
  variant="search"
  placeholder="Search..."
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>
```

### 5. Password Variant (with show/hide toggle)
```tsx
<Input
  variant="password"
  label="Password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
```

### 6. With Custom Icons
```tsx
<Input
  leftIcon={<Mail className="w-5 h-5 text-gray-500" />}
  rightIcon={<Check className="w-5 h-5 text-green-500" />}
  placeholder="Email"
/>
```

### 7. Disabled State
```tsx
<Input
  disabled
  value="Cannot edit"
  label="Disabled Field"
/>
```

### 8. In a Form
```tsx
<form onSubmit={handleSubmit}>
  <Input
    name="email"
    type="email"
    label="Email"
    required
    onChange={handleChange}
  />
  <Input
    name="password"
    variant="password"
    label="Password"
    required
    onChange={handleChange}
  />
</form>
```

## Key Points

- **Two Variants**: Default and Search (with search icon), Password (with show/hide toggle)
- **Icon Support**: Left and right icon slots for visual context
- **Helper Text**: Display guidance below the input
- **Error States**: Red border and error message display
- **Label Support**: Optional label above input
- **Input Types**: Supports all HTML5 input types (text, email, password, number, date, url, tel, etc.)
- **Disabled State**: Visual styling for disabled inputs
- **Required Fields**: Supports required attribute
- **Auto-focus**: Supports autoFocus prop
- **Custom Styling**: Accepts className prop for additional styles
- **Accessible**: Proper ARIA labels and associations

## Props

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode;   // Label above input
  helperText?: string;                 // Helper text below input
  error?: string;                      // Error message (shows red state)
  leftIcon?: React.ReactNode;          // Icon on left side
  rightIcon?: React.ReactNode;         // Icon on right side
  variant?: 'default' | 'search' | 'password';
  className?: string;                  // Additional CSS classes
}
```

## Related Documentation

- Main Component: `/src/components/Input.tsx`
- Design System: `/src/design-system/theme.ts`
- Form Components: `/src/components/`
