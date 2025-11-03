# Live Session Intelligence - Quality Checklist

**Version:** 1.0
**Date:** 2025-11-02
**Purpose:** Ensure production-ready quality for all deliverables

---

## Code Quality Checklist

### TypeScript Quality

**For Every File:**
- [ ] TypeScript strict mode enabled
- [ ] Zero TypeScript errors
- [ ] No `any` types (except unavoidable external library types)
- [ ] All exports have JSDoc documentation
- [ ] Interfaces exported for public APIs
- [ ] Enums used for string constants where appropriate
- [ ] Type guards for runtime type checking where needed

**Naming Conventions:**
- [ ] PascalCase for classes, interfaces, types, components
- [ ] camelCase for variables, functions, methods
- [ ] SCREAMING_SNAKE_CASE for constants
- [ ] Private methods prefixed with underscore (e.g., `_privateMethod`)
- [ ] Boolean variables prefixed with `is`, `has`, `should` (e.g., `isLoading`, `hasError`)

---

### React Component Quality

**For Every Component:**
- [ ] Functional component with hooks (no class components)
- [ ] Props interface exported
- [ ] Default props defined where appropriate
- [ ] Memoization used for expensive computations (useMemo, useCallback)
- [ ] No memory leaks (all useEffect cleanup functions implemented)
- [ ] No direct DOM manipulation (use refs only when necessary)
- [ ] Accessibility: ARIA labels on interactive elements
- [ ] Accessibility: Keyboard navigation support
- [ ] Accessibility: Focus states visible
- [ ] Responsive design (works on different screen sizes)

**Component Structure:**
```typescript
/**
 * ComponentName - Brief description
 *
 * Detailed explanation of what this component does,
 * when to use it, and any important constraints.
 *
 * @example
 * ```tsx
 * <ComponentName prop="value" />
 * ```
 */
export interface ComponentNameProps {
  /** Description of prop */
  propName: string;
}

export function ComponentName({ propName }: ComponentNameProps) {
  // Hooks first
  const [state, setState] = useState();

  // Derived state
  const derivedValue = useMemo(() => ..., [dependencies]);

  // Event handlers
  const handleEvent = useCallback(() => {
    // ...
  }, [dependencies]);

  // Effects last
  useEffect(() => {
    // ...
    return () => {
      // cleanup
    };
  }, [dependencies]);

  return (
    // JSX
  );
}
```

---

### Service/Class Quality

**For Every Service:**
- [ ] Single responsibility principle
- [ ] Dependency injection (constructor parameters)
- [ ] Error handling comprehensive
- [ ] Async operations properly typed (Promise<T>)
- [ ] Logging for debugging (console.log for info, console.error for errors)
- [ ] Performance considerations (avoid O(n²) algorithms)
- [ ] No global state mutation (except explicit state managers)

**Class Structure:**
```typescript
/**
 * ServiceName - Brief description
 *
 * Detailed explanation of service responsibilities.
 */
export class ServiceName {
  // Private properties first
  private dependency: DependencyType;
  private cache: Map<string, any> = new Map();

  // Constructor with dependency injection
  constructor(dependency: DependencyType) {
    this.dependency = dependency;
  }

  // Public methods
  public async publicMethod(): Promise<Result> {
    // Implementation
  }

  // Private methods
  private _privateHelper(): void {
    // Implementation
  }
}
```

---

### Testing Quality

**Unit Tests:**
- [ ] Each service: 80%+ code coverage
- [ ] Each component: 70%+ code coverage
- [ ] Each utility function: 90%+ code coverage
- [ ] Test file naming: `{filename}.test.ts` or `{filename}.test.tsx`
- [ ] Test structure: Arrange-Act-Assert pattern
- [ ] Descriptive test names: `it('should do X when Y happens', () => {})`
- [ ] Mock external dependencies (API calls, Tauri invoke, etc.)
- [ ] Test edge cases (empty inputs, null, undefined, errors)

**Integration Tests:**
- [ ] Critical paths: 100% coverage
- [ ] End-to-end flows tested
- [ ] Real dependencies (no mocks) where possible
- [ ] Performance verified (response times)

**Test Structure:**
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should return correct result when valid input provided', () => {
      // Arrange
      const service = new ServiceName(mockDependency);
      const input = { valid: true };

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw error when invalid input provided', () => {
      // Arrange
      const service = new ServiceName(mockDependency);
      const input = { valid: false };

      // Act & Assert
      expect(() => service.methodName(input)).toThrow('Expected error');
    });
  });
});
```

---

### Performance Quality

**For Every Feature:**
- [ ] UI interactions: <100ms response time
- [ ] API queries: <200ms for structured, <3s for natural language
- [ ] Summary generation: <5s end-to-end
- [ ] No blocking operations on main thread
- [ ] Animations: 60fps (use GPU-accelerated transforms)
- [ ] Memory leaks: None (verified with Chrome DevTools)
- [ ] Bundle size: Incremental increase <50KB

**Performance Testing:**
- [ ] React DevTools Profiler: No unnecessary renders
- [ ] Chrome DevTools Performance: No long tasks (>50ms)
- [ ] Lighthouse: Performance score 90+
- [ ] Memory Profiler: No memory leaks after 1-hour session

---

### Accessibility Quality (WCAG AA)

**For Every Interactive Component:**
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus states visible (outline or custom focus style)
- [ ] ARIA labels on all buttons, inputs, interactive elements
- [ ] ARIA roles where appropriate (dialog, menu, tab, etc.)
- [ ] Color contrast: 4.5:1 for normal text, 3:1 for large text
- [ ] Screen reader tested (VoiceOver on macOS)
- [ ] No keyboard traps
- [ ] Focus returns to trigger element after modal close

**Accessibility Testing:**
- [ ] axe DevTools: 0 violations
- [ ] VoiceOver: All elements announced correctly
- [ ] Keyboard-only navigation: All features accessible

---

## Documentation Quality

### Code Documentation (JSDoc)

**For Every Public API:**
```typescript
/**
 * Brief one-line description
 *
 * Detailed multi-line explanation of what this does,
 * when to use it, and any constraints or gotchas.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} Description of when error is thrown
 *
 * @example
 * ```typescript
 * const result = functionName('example');
 * console.log(result); // Output: ...
 * ```
 */
```

**For Every Component:**
```typescript
/**
 * ComponentName - Brief description
 *
 * Detailed explanation including:
 * - What it displays
 * - When to use it
 * - Important props
 * - Behavior notes
 *
 * @example
 * ```tsx
 * <ComponentName
 *   prop1="value"
 *   prop2={true}
 *   onEvent={handleEvent}
 * />
 * ```
 */
```

### API Documentation

**For External API:**
- [ ] All endpoints documented
- [ ] Request format with examples
- [ ] Response format with examples
- [ ] Error codes explained
- [ ] Authentication documented
- [ ] Rate limits specified (if any)
- [ ] Working code examples (tested)
- [ ] Integration guide (step-by-step)

**API Doc Structure:**
```markdown
## Endpoint Name

**Description:** What this endpoint does

**Endpoint:** `POST /api/sessions/active/query`

**Authentication:** Bearer token

**Request Format:**
```json
{
  "type": "natural",
  "question": "What am I working on?"
}
```

**Response Format:**
```json
{
  "answer": "You're debugging authentication...",
  "confidence": 0.95,
  "sources": [...]
}
```

**Error Codes:**
- 400: Invalid request format
- 401: Unauthorized
- 500: Internal server error

**Example (JavaScript):**
```javascript
const response = await fetch('/api/sessions/active/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'natural',
    question: 'What am I working on?'
  })
});
const data = await response.json();
console.log(data.answer);
```
```

### User Documentation

**For Every User-Facing Feature:**
- [ ] What it does (1-2 sentences)
- [ ] How to use it (step-by-step)
- [ ] Screenshots or GIFs
- [ ] Tips and best practices
- [ ] FAQ for common questions
- [ ] Troubleshooting section

---

## UI/UX Quality

### Visual Design

**For Every UI Component:**
- [ ] Matches design system (colors, spacing, typography)
- [ ] Consistent with existing UI (ActiveSessionView, Library, etc.)
- [ ] Glass morphism effects where appropriate
- [ ] Pill-shaped buttons (rounded-full)
- [ ] Proper spacing (Tailwind spacing scale)
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Dark mode support (if applicable)

### Animations

**For Every Animation:**
- [ ] Framer Motion for React animations
- [ ] GPU-accelerated transforms (translate, scale, opacity)
- [ ] Avoid layout-triggering properties (width, height, top, left)
- [ ] 60fps performance verified
- [ ] Easing curves appropriate (spring for interactive, ease for transitions)
- [ ] Duration appropriate (100-300ms for UI, 300-500ms for emphasis)
- [ ] Respects prefers-reduced-motion

**Animation Checklist:**
```typescript
// ✅ GOOD: GPU-accelerated
<motion.div
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: 'spring', damping: 20 }}
/>

// ❌ BAD: Triggers layout
<motion.div
  animate={{ height: 200, top: 50 }}
/>
```

### User Feedback

**For Every User Action:**
- [ ] Loading states shown (spinner, skeleton, progress)
- [ ] Success feedback (toast, checkmark, animation)
- [ ] Error feedback (toast, error message, red highlight)
- [ ] Disabled states clear (opacity, cursor not-allowed)
- [ ] Hover states (subtle highlight, cursor pointer)
- [ ] Active states (pressed appearance)

---

## Security Quality

### API Security

**For Every API Endpoint:**
- [ ] Input validation (reject malformed requests)
- [ ] Authentication required (API key, session token)
- [ ] Rate limiting (prevent abuse)
- [ ] Error messages don't leak sensitive info
- [ ] No SQL injection vectors (use parameterized queries)
- [ ] No XSS vectors (sanitize user input)

### Client Security

**For Every Client Feature:**
- [ ] API keys stored securely (Tauri secure storage)
- [ ] No sensitive data in console.log (production)
- [ ] No hardcoded credentials
- [ ] Validate all external inputs
- [ ] Use HTTPS for all external requests

---

## Git Quality

### Commit Messages

**Format:**
```
type(scope): Brief description (max 72 chars)

Detailed explanation of what changed and why.
Can be multiple paragraphs.

- Bullet points for specific changes
- Reference issue numbers if applicable

Closes #123
```

**Types:**
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- refactor: Code refactoring
- test: Test changes
- perf: Performance improvement
- chore: Build/tooling changes

**Example:**
```
feat(query-api): Add natural language query support

Implemented natural language query handler that uses Claude
to process user questions about active sessions.

- Added SessionQueryEngine.naturalLanguageQuery method
- Integrated LiveSessionContextProvider for AI context
- Added comprehensive tests with mock Claude responses
- Updated API documentation with examples

Closes #42
```

### Pull Request Quality

**For Every PR:**
- [ ] Title describes change clearly
- [ ] Description explains what, why, how
- [ ] Screenshots for UI changes
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Code reviewed by 2+ developers
- [ ] Changelog updated
- [ ] Breaking changes documented

**PR Template:**
```markdown
## What
Brief description of what this PR does

## Why
Why is this change needed?

## How
How was it implemented?

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots
(If UI change)

## Checklist
- [ ] Tests passing
- [ ] TypeScript errors: 0
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Breaking changes noted
```

---

## Final Quality Gates

### Phase Completion Gates

**Before Moving to Next Phase:**
- [ ] All tasks in current phase complete
- [ ] All tests passing (unit + integration)
- [ ] Code review passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] No TypeScript errors
- [ ] No console errors in production build

### Production Readiness Gates

**Before Launch:**
- [ ] All quality checklists complete
- [ ] All tests passing (100%)
- [ ] Performance targets met (all metrics)
- [ ] Accessibility audit passed (0 violations)
- [ ] Security audit passed
- [ ] API documentation published
- [ ] User documentation published
- [ ] External tool examples tested
- [ ] Final code review passed
- [ ] Changelog complete
- [ ] Release notes written

---

## Continuous Quality

### Daily Checks

**Every Day:**
- [ ] Run full test suite (npm test)
- [ ] Check TypeScript errors (npm run type-check)
- [ ] Review test coverage (npm run test:coverage)
- [ ] Check for console errors
- [ ] Monitor performance metrics

### Weekly Checks

**Every Week:**
- [ ] Run Lighthouse audit
- [ ] Run axe accessibility audit
- [ ] Check bundle size
- [ ] Review error logs (if any)
- [ ] Update documentation for new changes

---

## Quality Tools

**Automated Tools:**
- TypeScript: Strict mode type checking
- ESLint: Code quality and consistency
- Prettier: Code formatting
- Vitest: Unit and integration testing
- React Testing Library: Component testing
- axe DevTools: Accessibility testing
- Lighthouse: Performance and accessibility auditing
- Chrome DevTools: Performance profiling, memory leak detection

**Manual Tools:**
- VoiceOver: Screen reader testing
- BrowserStack: Cross-browser testing (if web version)
- React DevTools: Component profiling

---

## Responsibility Matrix

**Agent 1 (Backend):**
- TypeScript quality for services
- Performance of query operations
- API security
- Unit test coverage for services

**Agent 2 (Interactive AI):**
- Component quality (Q&A, query interface)
- Animation smoothness
- Accessibility for interactive components
- Unit test coverage for components

**Agent 3 (Action-Oriented UI):**
- Component quality (suggestions, panels)
- Visual design consistency
- Responsive design
- Unit test coverage for components

**Agent 4 (Integration & Quality):**
- Integration test coverage
- Performance optimization
- Accessibility audit
- API documentation quality
- Final production readiness

---

## Summary

This checklist ensures **production-ready quality** across:
- ✅ Code (TypeScript, React, Services)
- ✅ Testing (Unit, Integration, Performance)
- ✅ Documentation (Code, API, User)
- ✅ UI/UX (Design, Animations, Accessibility)
- ✅ Security (API, Client)
- ✅ Git (Commits, PRs)

**Use this checklist throughout development** to maintain quality standards and catch issues early.
