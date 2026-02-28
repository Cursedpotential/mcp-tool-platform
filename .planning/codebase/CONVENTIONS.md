# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- **Go**: `lowercase_snake_case.go` (e.g., `main.go`, `gui_stub.go`, `registry.go`)
- **TypeScript**: `lowerCamelCase.ts` for modules, `PascalCase.tsx` for React components (e.g., `db.ts`, `db.test.ts`, `App.test.tsx`)
- **Test files**: Same as source with `.test.` or `.spec.` suffix (e.g., `db.test.ts`, `App.config.test.tsx`)
- **Config files**: `lowercase.config.js` or `lowercase.config.cjs` (e.g., `jest.config.cjs`, `vitest.config.mts`)

**Functions:**
- **Go**: `camelCase` (e.g., `runGUI()`, `getMachineVars()`, `filterVars()`)
- **TypeScript**: `camelCase` (e.g., `initDatabase()`, `migrateSchema()`, `insertExchange()`)
- **React hooks**: `camelCase` with `use` prefix (e.g., `useToolOperation()`, `useToolState()`)

**Variables:**
- **Go**: `camelCase` for local variables (e.g., `name`, `value`, `keys`)
- **Constants**: `camelCase` or `UPPER_SNAKE_CASE` for package-level constants (e.g., `envRegistryPath`, `guiWindowWidth`, `filterKeywords`)
- **TypeScript**: `camelCase` (e.g., `exchange`, `embedding`, `testDir`)

**Types:**
- **Go**: `PascalCase` for struct names (e.g., `ScanStatus`, `FileNode`, `CLIResult`)
- **TypeScript**: `PascalCase` for interfaces (e.g., `ConversationExchange`, `SearchResult`, `ScanOptions`)
- **Go interfaces**: `PascalCase` (e.g., `interface{ Attributes() uint32 }`)

## Code Style

**Formatting:**
- **Prettier** is used for JavaScript/TypeScript projects
  - Config: `.prettierrc` at project root
  - Key settings: `semi: true`, `singleQuote: false`, `printWidth: 80`, `tabWidth: 2`
  - LF line endings enforced: `"endOfLine": "lf"`
- **Go**: No explicit formatter detected (gofmt is standard but not confirmed in configs)
  - Tabs for indentation (Go standard)
  - Single-line imports when few packages

**Linting:**
- **ESLint** is used for TypeScript projects
  - Config files: `eslint.config.js`, `eslint.config.mjs`, or `.eslintrc.js`
  - Uses `typescript-eslint` for TypeScript support
  - `react-hooks` plugin for React projects
  - Example config location: `D:/AI_Workspace/04_Component_Library/Plugins_&_Tools/External_Utils_Lib/inspector-main/client/eslint.config.js`
- **Spotless** used in Java projects (Stirling-PDF)
  - Enforces Google Java Format
  - Runs automatically before compilation

## Import Organization

**Order:**
1. **Go**: Standard library imports grouped together, then third-party imports
   ```go
   import (
     "fmt"
     "strings"
     "unsafe"

     "golang.org/x/sys/windows"
     "golang.org/x/sys/windows/registry"
   )
   ```
2. **TypeScript**: External imports first, then local imports
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   import fs from 'fs';
   import path from 'path';
   import { initDatabase, insertExchange } from './db.js';
   ```

**Path Aliases:**
- **React/Vite projects**: `@/` alias for `src/` directory (e.g., `@/components/Header`)
- **TypeScript path mapping**: Configured in `tsconfig.json` via `compilerOptions.paths`
- **Go**: No path aliases detected - uses relative imports like `./db.js`

## Error Handling

**Patterns:**
- **Go**: Multiple return values `(result, error)` pattern
  ```go
  func getMachineVars() (map[string]string, error) {
    // ...
    if err != nil {
      return nil, fmt.Errorf("failed to open registry: %w", err)
    }
    return vars, nil
  }
  ```
- **TypeScript**: `try/catch` with error propagation
  ```typescript
  try {
    const db = new Database(dbPath);
    return db;
  } catch (err) {
    cliOutput(CLIResult{Success: false, Action: "error", Message: err.Error()});
    os.Exit(1);
  }
  ```
- **Error wrapping**: Go uses `fmt.Errorf("context: %w", err)` for error context
- **TypeScript tests**: `expect().not.toThrow()` for error-free assertions

## Logging

**Framework:**
- **Go**: `fmt.Fprintln(os.Stderr, ...)` for error output to stderr
  - No structured logging framework detected
  - Errors go to stderr, JSON CLI output to stdout
- **TypeScript**: `console.log()` for development logging
  - No logging framework detected in analyzed projects

**Patterns:**
- **CLI tools**: JSON output to stdout for programmatic use, errors to stderr
  ```go
  cliOutput(CLIResult{Success: true, Action: "list", ...})  // stdout
  fmt.Fprintln(os.Stderr, "error: invalid format")              // stderr
  ```
- **Progress reporting**: Callback functions for long-running operations
  ```go
  progressFunc := func(ScanProgress) { /* UI updates */ }
  scanner.ScanWithProgress(ctx, options, progressFunc, session)
  ```

## Comments

**When to Comment:**
- Package-level documentation before `package main`
- Public function documentation (Go conventions)
- TODO/FIXME markers for temporary solutions
- Platform-specific code (Windows vs Linux paths)

**JSDoc/TSDoc:**
- **TypeScript interfaces**: No JSDoc observed - interfaces are self-documenting
- **Go functions**: No explicit documentation comments found in analyzed code
- **React components**: Some projects use inline documentation strings

## Function Design

**Size:**
- **Go**: Functions typically 10-50 lines
  - Small focused functions like `verifyVar()`, `parseBulkInput()`
  - Larger functions with clear sections like `scanDirectory()` (80+ lines)
- **TypeScript**: Functions typically 10-40 lines
  - Test setup/teardown in separate functions

**Parameters:**
- **Go**: Explicit parameters, returning multiple values
  ```go
  func insertExchange(db: Database.Database, exchange: ConversationExchange, embedding: number[]): void
  ```
- **TypeScript**: Parameter objects for complex signatures
  ```typescript
  function ScanWithProgress(
    ctx context.Context,
    options ScanOptions,
    progressFunc func(ScanProgress),
    session *ScanSession,
  ): (*FileNode, error)
  ```

**Return Values:**
- **Go**: Named return values for clarity
  ```go
  func verifyVar(name, expectedValue string) (bool, string) {
    // ...
  }
  ```
- **TypeScript**: Explicit return types with interfaces
  ```typescript
  function getAllExchanges(db: Database.Database): Array<{ id: string; archivePath: string }> {
    // ...
  }
  ```

## Module Design

**Exports:**
- **Go**: `func`/`type`/`const` with uppercase first letter exported
  ```go
  func runGUI() { ... }           // exported
  func hideConsole() { ... }       // exported
  type tuiModel struct { ... }     // unexported (lowercase t)
  ```
- **TypeScript**: `export` keyword for modules
  ```typescript
  export interface ConversationExchange { ... }
  export function initDatabase(): Database.Database { ... }
  export default defineConfig(...)  // default export
  ```
- **Go package naming**: `package main` for executables, lowercase for libraries

**Barrel Files:**
- **Go**: Not observed in analyzed code
- **TypeScript**: Not observed in analyzed code
- Projects use direct imports like `import { initDatabase } from './db.js'`

## Platform-Specific Conventions

**Build Tags (Go):**
- Conditional compilation using build tags
  ```go
  //go:build gui
  package main  // gui.go - only compiled with -tags gui

  //go:build !gui
  package main  // gui_stub.go - compiled without gui tag
  ```
- Enables GUI-less builds without requiring GCC/MinGW

**Windows-Specific Code:**
- Go projects use `golang.org/x/sys/windows` for Windows API
  - Registry access via `windows/registry`
  - Console hiding via `windows` package functions
- Path handling: Both `/` and `\\` observed for Windows compatibility
- Drive letter checks: `if len(abs) > 1 && abs[1] == ':'` for Windows path detection

## Database Conventions

**SQLite:**
- **Connection management**: Open/close pattern with `defer key.Close()`
- **Prepared statements**: Reused for performance
  ```go
  stmt := db.prepare(`SELECT ... FROM exchanges WHERE id = ?`)
  stmt.get('test-id-1')
  ```
- **Migrations**: Schema versioning with `migrateSchema()` function
- **WAL mode**: Enabled for concurrency: `db.pragma('journal_mode = WAL')`

**Vector Storage:**
- **sqlite-vec** extension for vector similarity search
- Embedding storage as `BLOB` in main table, separate virtual table for search
- Float32Array conversion to Buffer for storage

## React Conventions

**Components:**
- Functional components with hooks
- `PascalCase` naming for components
- Props interfaces defined before component
- `children` prop for composition

**Hooks:**
- `use` prefix for custom hooks
- Hook composition for complex logic
- Example: `useToolOperation()` orchestrates `useToolState()`, `useToolApiCalls()`, `useToolResources()`

**Styling:**
- **Tailwind CSS**: Utility-first classes (e.g., `text-lg`, `bg-blue-500`)
- **Lipgloss** (Go TUI): Declarative styles
  ```go
  titleStyle = lipgloss.NewStyle().
      Bold(true).
      Foreground(lipgloss.Color("86")).
      MarginLeft(2)
  ```

---

*Convention analysis: 2026-02-23*
