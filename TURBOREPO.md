# Turborepo Setup for Taskerino

This project now uses [Turborepo](https://turbo.build) to optimize build and development workflows.

## What is Turborepo?

Turborepo is a high-performance build system that provides:
- **Intelligent caching**: Only rebuild what has changed
- **Parallel execution**: Run tasks across multiple cores
- **Remote caching**: Share build artifacts across your team
- **Task pipelines**: Define dependencies between tasks

## Configuration

### turbo.json

The main Turborepo configuration file defines task pipelines:

- `build`: Builds the frontend with TypeScript compilation and Vite bundling
- `tauri:build`: Builds the Tauri app (depends on `build`)
- `dev`: Runs the Vite development server
- `tauri:dev`: Runs the Tauri app in development mode
- `lint`: Runs ESLint
- `type-check`: Runs TypeScript type checking
- `test`: Runs Vitest tests
- `test:coverage`: Runs tests with coverage reporting

### .turborc

Configures Turbo to use `bun` as the package manager.

## Usage

### Development

```bash
# Run development server with Turbo caching
bun run dev

# Run Tauri app in development mode
bun run tauri:dev
```

### Building

```bash
# Build the frontend
bun run build

# Build the Tauri application
bun run tauri:build

# Build for production (both frontend and Tauri)
bun run build:production
```

### Testing

```bash
# Run tests (cached)
bun run test

# Run tests with UI
bun run test:ui

# Run tests with coverage
bun run test:coverage
```

### Code Quality

```bash
# Run linter (cached)
bun run lint

# Run type checking (cached)
bun run type-check
```

### Turbo-Specific Commands

```bash
# Clear Turbo cache
bun run clean

# Run a specific task with Turbo
bun turbo run <task-name>

# Run multiple tasks
bun turbo run build test lint

# Force a task to run (ignore cache)
bun turbo run build --force

# See what would be cached
bun turbo run build --dry-run
```

## Direct Commands (Bypass Turbo)

If you need to bypass Turbo for any reason, you can use these direct commands:

```bash
bun run dev:vite          # Direct Vite dev server
bun run dev:tauri         # Direct Tauri dev
bun run build:vite        # Direct Vite build
bun run build:tauri       # Direct Tauri build
bun run lint:eslint       # Direct ESLint
bun run type-check:tsc    # Direct TypeScript check
bun run test:vitest       # Direct Vitest
```

## Benefits for Taskerino

1. **Faster Builds**: Turborepo caches build outputs, so subsequent builds are much faster
2. **Parallel Execution**: Multiple tasks can run simultaneously when there are no dependencies
3. **Incremental Builds**: Only rebuilds what has changed
4. **Better CI/CD**: Cache build artifacts in CI for faster deployment pipelines
5. **Development Speed**: Faster feedback loops during development

## Cache Location

Turbo stores its cache in `.turbo/` (gitignored). This directory contains:
- Task output caches
- Task logs
- Metadata about previous runs

## Remote Caching (Optional)

To enable remote caching for your team:

1. Sign up at [Vercel](https://vercel.com)
2. Run `bunx turbo login`
3. Run `bunx turbo link`
4. Update `turbo.json` to enable remote cache:

```json
{
  "remoteCache": {
    "enabled": true
  }
}
```

## Troubleshooting

### Clear cache if you encounter issues

```bash
bun run clean
```

### View task logs

```bash
# Turbo saves logs in .turbo/runs/
cat .turbo/runs/<task-id>.log
```

### Force rebuild

```bash
bun turbo run build --force
```

## Migration Notes

All existing scripts have been preserved as direct commands (e.g., `dev:vite`, `build:vite`), while the main commands now use Turbo for improved performance.

