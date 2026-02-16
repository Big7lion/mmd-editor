# AGENTS.md - Agent Guidelines for beautiful-mermaid

When you need to search docs, use `context7` tools.

## Project Overview

- **Project Name**: beautiful-mermaid
- **Type**: Desktop Application (Tauri v2 + React + shadcn/ui)
- **Description**: A Mermaid diagram editor desktop app with live preview, syntax validation, theme switching, and export functionality
- **Main Entry**: src/App.tsx

---

## Build, Lint, and Test Commands

### Core Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start development server (frontend only)
npm run dev

# Start Tauri development (with hot reload)
npm run tauri dev

# Build Tauri app for production
npm run tauri build

# Preview production build
npm run preview
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without fixing
npm run format:check
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (interactive)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a single test file
npm test -- src/utils/helper.test.ts

# Run tests matching a pattern (grep)
npm test -- --grep "helper function"

# Run a specific test by name
npm test -- -t "should calculate correctly"
```

### Type Checking

```bash
# Run TypeScript type checking
npm run typecheck
```

---

## Code Style Guidelines

### General Principles

- Write clean, readable, and maintainable code
- Keep components small and focused (single responsibility)
- Use meaningful names that convey intent
- Comment only when necessary (why, not what)

### Formatting

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons at the end of statements
- Maximum line length: 100 characters
- Add trailing commas in multiline objects/arrays

### TypeScript Conventions

- **Always use explicit types** for function parameters and return types
- Use `interface` for object shapes, `type` for unions/intersections
- Avoid `any` - use `unknown` when type is truly unknown
- Use `as` assertions only when necessary, prefer type guards
- Enable strict mode in tsconfig.json

```typescript
// Good
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Avoid
function calculateTotal(items: any[]): any {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `MermaidEditor`, `Toolbar` |
| Variables | camelCase | `userName`, `isActive` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Functions | camelCase (verb + noun) | `getUserById()`, `calculateTotal()` |
| Files (components) | PascalCase | `MermaidEditor.tsx` |
| Files (utils) | kebab-case | `date-helper.ts` |
| Boolean variables | is/has/can/should prefix | `isActive`, `hasPermission` |

### React Conventions

- Use functional components with hooks
- Prefer composition over inheritance
- Keep state as local as possible
- Use TypeScript for prop types (no PropTypes)

```typescript
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  children: React.ReactNode
  onClick?: () => void
}
```

### Imports

- Use `@/` alias for src/ root imports
- Group imports in order: external → internal → relative
- Use named exports, avoid default exports

```typescript
// External (npm packages)
import { useState, useEffect } from 'react'
import { save } from '@tauri-apps/plugin-dialog'

// Internal (from @/)
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Relative
import { calculateTotal } from '../utils/cart-helpers'
```

### shadcn/ui Components

This project uses shadcn/ui for components. To add a new component:

```bash
# Components are in src/components/ui/
# Manually add new components from shadcn/ui documentation
```

Available components:
- Button (src/components/ui/button.tsx)
- Select (src/components/ui/select.tsx)
- Tooltip (src/components/ui/tooltip.tsx)
- Separator (src/components/ui/separator.tsx)

### Tailwind CSS

- Use Tailwind v4 with `@import "tailwindcss"`
- Use `cn()` utility for conditional classes
- Follow shadcn/ui design tokens

```typescript
import { cn } from '@/lib/utils'

<Button className={cn("w-full", isActive && "bg-primary")}>
  Click me
</Button>
```

### Error Handling

- Use try/catch for async operations
- Create custom error classes for domain-specific errors
- Always log errors with context for debugging
- Return meaningful error messages to users

```typescript
try {
  const content = await readTextFile(filePath)
  setCode(content)
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  setStatus(`Failed to open: ${errorMessage}`)
  setIsError(true)
}
```

### File Organization

```
src/
├── main.tsx           # Entry point
├── App.tsx            # Main application component
├── index.css          # Global styles (Tailwind)
├── components/
│   ├── ui/           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── select.tsx
│   │   ├── tooltip.tsx
│   │   └── separator.tsx
│   └── ...
├── lib/
│   └── utils.ts       # Utility functions (cn)
└── hooks/             # Custom React hooks
```

### Testing Guidelines

- Place tests alongside source files with `.test.tsx` or `.test.ts` suffix
- Use `@testing-library/react` for component testing
- Follow AAA pattern: Arrange → Act → Assert

```typescript
describe('MermaidEditor', () => {
  it('should render the editor', () => {
    render(<MermaidEditor />)
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })
})
```

### Git Conventions

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep commits atomic and focused
- Write meaningful commit messages

---

## Tauri Development Notes

### Adding New Tauri Plugins

1. Add the npm package: `npm install @tauri-apps/plugin-<name>`
2. Add the Rust crate to `src-tauri/Cargo.toml`
3. Register the plugin in `src-tauri/src/lib.rs`
4. Add permissions in `src-tauri/capabilities/default.json`

### Running the App

```bash
# Development mode with hot reload
npm run tauri dev

# Production build
npm run tauri build

# Run the built app directly
open src-tauri/target/release/bundle/macos/Mermaid\ Editor.app
```

---

## Dependencies

- **Tauri v2** - Desktop app framework
- **React 19** - UI framework
- **beautiful-mermaid** - Mermaid diagram rendering
- **CodeMirror 6** - Code editor component
- **shadcn/ui** - UI component library
- **Tailwind CSS v4** - Styling
- **@tauri-apps/plugin-dialog** - Native file dialogs
- **@tauri-apps/plugin-fs** - File system operations
- **lucide-react** - Icons
