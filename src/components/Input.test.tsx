/**
 * Quick validation test for Input component
 * This demonstrates that the component exports correctly and has proper types
 */

import { Input } from './Input';
import { Mail } from 'lucide-react';

// Type checking - these should all compile without errors
const test1 = (
  <Input placeholder="test" />
);

const test2 = (
  <Input
    label="Email"
    type="email"
    placeholder="you@example.com"
    helperText="Helper text"
  />
);

const test3 = (
  <Input
    variant="search"
    placeholder="Search..."
  />
);

const test4 = (
  <Input
    variant="password"
    label="Password"
  />
);

const test5 = (
  <Input
    leftIcon={<Mail className="w-5 h-5" />}
    error="Error message"
    disabled
  />
);

// With all standard HTML input props
const test6 = (
  <Input
    name="username"
    id="username"
    required
    maxLength={50}
    minLength={3}
    pattern="[a-zA-Z0-9]+"
    autoComplete="username"
    autoFocus
    onChange={(e) => console.log(e.target.value)}
    onBlur={() => console.log('blur')}
    onFocus={() => console.log('focus')}
  />
);

export { test1, test2, test3, test4, test5, test6 };
