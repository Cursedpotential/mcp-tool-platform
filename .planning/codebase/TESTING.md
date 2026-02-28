# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Runners:**
- **Vitest** - TypeScript/JavaScript testing (ESM native)
  - Config: `vitest.config.ts` or no config (defaults)
  - Projects: `D:/AI_Workspace/04_AI_Assets/Skills/remembering-conversations/tool/`
- **Jest** - TypeScript/JavaScript testing (CommonJS/ESM)
  - Config: `jest.config.js`, `jest.config.cjs`, or `ts-jest` preset
  - Projects: `D:/AI_Workspace/04_Component_Library/Plugins_&_Tools/External_Utils_Lib/inspector-main/client/`
- **Cucumber** - BDD integration testing (Java projects)
  - Config: `cucumber.config.js`
  - Projects: `D:/AI_Workspace/03_TraceIQ_Lab/Junkyard/Source_B_BigOne_Repo/Timeline-Takeout-Ingestor/`

**Assertion Libraries:**
- **Vitest/Jest**: Built-in `expect` API
- **Playwright**: For E2E browser tests

**Run Commands:**
```bash
# Vitest (TypeScript ESM)
npm run test              # Run all tests
npm run test:watch        # Watch mode (from package.json)

# Jest
npm test                 # Run all tests (default)
npm test -- --watch     # Watch mode

# Go (go test)
go test ./...            # Run all tests in current directory and subdirectories
go test -v ./...        # Verbose output

# Cucumber (Java)
./gradlew cucumber       # Run Cucumber tests
./test.sh               # Run full test suite (Docker variants)
```

## Test File Organization

**Location:**
- **Co-located**: Test files in same directory as source (e.g., `src/db.ts` + `src/db.test.ts`)
- **Separate test directories**: Some projects use `tests/` or `__tests__/` folders
  - Example: `D:/AI_Workspace/04_Component_Library/Plugins_&_Tools/External_Utils_Lib/inspector-main/client/src/__tests__/`

**Naming:**
- **Vitest/Jest**: `<source>.test.ts` or `<source>.spec.ts`
  - Examples: `db.test.ts`, `verify.test.ts`, `search-agent-template.test.ts`, `App.config.test.tsx`
- **Playwright E2E**: `*.spec.ts` (excluded from unit tests via config)
- **Go**: `*_test.go` suffix
  - Examples: `db_test.go`, `scanner_test.go` (if they existed)

**Structure:**
```
src/
├── db.ts                 # Source code
├── db.test.ts            # Unit tests for db.ts
├── verify.ts             # Source code
├── verify.test.ts         # Unit tests for verify.ts
└── types.ts              # Shared types
```

## Test Structure

**Suite Organization (Vitest):**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('verifyIndex', () => {
  const testDir = path.join(os.tmpdir(), 'conversation-search-test-' + Date.now());

  beforeEach(() => {
    // Create test directories and override environment paths
    fs.mkdirSync(testDir, { recursive: true });
    process.env.TEST_DB_PATH = dbPath;
  });

  afterEach(() => {
    // Clean up test directory and reset environment
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.TEST_DB_PATH;
  });

  it('detects missing summaries', async () => {
    // Create test data
    const projectArchive = path.join(archiveDir, 'test-project');
    fs.mkdirSync(projectArchive, { recursive: true });
    const messages = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00Z' }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'Hi there!' }, timestamp: '2024-01-01T00:00:01Z' })
    ];
    fs.writeFileSync(conversationPath, messages.join('\n'));

    // Execute function under test
    const result = await verifyIndex();

    // Assert results
    expect(result.missing.length).toBe(1);
    expect(result.missing[0].path).toBe(conversationPath);
    expect(result.missing[0].reason).toBe('No summary file');
  });
});
```

**Patterns:**
- **Setup**: `beforeEach()` creates temp directories, sets environment variables
- **Teardown**: `afterEach()` deletes temp directories, cleans environment
- **Test naming**: `it('does X when Y', ...)` or `it('detects X', ...)`
- **Timestamp-based paths**: Using `Date.now()` for unique test directories
- **Environment variable override**: Using `process.env.TEST_*` to control paths during tests

## Mocking

**Framework:**
- **Vitest/Jest**: Built-in mocking (`vi.mock()`, `jest.mock()`)
- **Node builtins**: Mocked via test setup files

**Patterns:**
```typescript
// Mock file system operations (rarely seen - using real temp dirs instead)
vi.mock('fs', () => ({
  // ...
}));

// Mock database for isolated testing
const testDir = path.join(os.tmpdir(), 'test-' + Date.now());
process.env.TEST_DB_PATH = path.join(testDir, 'test.db');
const db = initDatabase(); // Uses TEST_DB_PATH

// Verify mock worked by checking temp directory exists
expect(fs.existsSync(testDir)).toBe(true);
```

**What to Mock:**
- External APIs and network calls
- Database connections (use in-memory SQLite)
- File system (use temp directories instead of mocking)

**What NOT to Mock:**
- Core business logic
- Data transformations
- Simple I/O operations (use temp files)

## Fixtures and Factories

**Test Data:**
```typescript
// Direct creation in tests
const exchange: ConversationExchange = {
  id: 'test-id-1',
  project: 'test-project',
  timestamp: '2024-01-01T00:00:00Z',
  userMessage: 'Hello',
  assistantMessage: 'Hi there!',
  archivePath: '/test/path.jsonl',
  lineStart: 1,
  lineEnd: 2
};

// Embedding fixtures
const embedding = new Array(384).fill(0.1);

// JSONL format fixtures
const messages = [
  JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello' }, timestamp: '2024-01-01T00:00:00Z' }),
  JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'Hi there!' }, timestamp: '2024-01-01T00:00:01Z' })
];
fs.writeFileSync(conversationPath, messages.join('\n'));
```

**Location:**
- Test data created inline in test files (no dedicated fixtures directory observed)
- `test-fixtures/` directories exist but excluded from coverage in some projects

## Coverage

**Requirements:**
- **Jest projects**: Thresholds configured in `jest.config.cjs`
  ```javascript
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 20,
      lines: 30,
      statements: 30,
    },
  }
  ```
- **Vitest projects**: No coverage thresholds observed

**View Coverage:**
```bash
# Vitest
npx vitest run --coverage  # Generate coverage report

# Jest
npm test -- --coverage       # Generate coverage report

# Coverage reporters
# 'text', 'lcov', 'html', 'json-summary' (Jest)
# 'text', 'json', 'html' (Vitest)
```

**Coverage Collection:**
```javascript
// Jest config example
collectCoverageFrom: [
  'src/**/*.{ts,tsx}',
  '!src/**/*.d.ts',
  '!src/**/*.stories.tsx',
  '!src/**/*.test.{ts,tsx}',
  '!src/main.tsx',
],
```

## Test Types

**Unit Tests:**
- **Scope**: Test individual functions and components in isolation
- **Approach**: Use temp directories, environment variable overrides, direct function calls
- **Examples**: `D:/AI_Workspace/04_AI_Assets/Skills/remembering-conversations/tool/src/db.test.ts`

**Integration Tests:**
- **Scope**: Test multiple components working together
- **Approach**: Real database connections, file system operations, HTTP requests
- **Config**: Separate test configs (e.g., `jest.config.integration.cjs`)
- **Examples**: `D:/AI_Workspace/03_TraceIQ_Lab/Junkyard/Source_B_BigOne_Repo/Timeline-Takeout-Ingestor/frontend/tests/e2e/`

**E2E Tests:**
- **Framework**: Playwright for browser automation
- **Config**: `playwright.config.ts` or `playwright.config.js`
- **File naming**: `*.spec.ts` (distinguished from `*.test.ts` for unit tests)
- **Examples**: `D:/AI_Workspace/04_Component_Library/Plugins_&_Tools/External_Utils_Lib/inspector-main/client/e2e/`

## Common Patterns

**Async Testing:**
```typescript
it('detects missing summaries', async () => {
  // Async function under test
  const result = await verifyIndex();

  // Assertions on promise result
  expect(result.missing.length).toBe(1);
});
```

**Error Testing:**
```typescript
it('handles existing last_indexed column gracefully', () => {
  // Create database with migration already applied
  const db = initDatabase();

  // Run migration again - should not error
  expect(() => migrateSchema(db)).not.toThrow();

  db.close();
});
```

**Timeout Handling:**
```typescript
it('re-indexes outdated files during repair', { timeout: 30000 }, async () => {
  // Long-running test with custom timeout
  // ...
});
```

**Database Migration Testing:**
```typescript
it('adds last_indexed column to existing database', () => {
  // Create a database with old schema (no last_indexed)
  const db = new Database(dbPath);
  db.exec(`CREATE TABLE exchanges (...)`);

  // Verify column doesn't exist
  const columnsBefore = db.prepare(`PRAGMA table_info(exchanges)`).all();
  const hasLastIndexedBefore = columnsBefore.some((col: any) => col.name === 'last_indexed');
  expect(hasLastIndexedBefore).toBe(false);

  db.close();

  // Run migration
  const migratedDb = initDatabase();

  // Verify column now exists
  const columnsAfter = migratedDb.prepare(`PRAGMA table_info(exchanges)`).all();
  const hasLastIndexedAfter = columnsAfter.some((col: any) => col.name === 'last_indexed');
  expect(hasLastIndexedAfter).toBe(true);

  migratedDb.close();
});
```

## Go Testing (Observed Pattern)

**No Go tests found** in analyzed codebase:
- `D:/AI_Workspace/03_Satellite_Tools/EnvManager/` - No `*_test.go` files
- `D:/AI_Workspace/04_Component_Library/Plugins_&_Tools/External_Utils_Lib/DirectoryScanner/` - No `*_test.go` files

**Expected Go test pattern** (based on standard conventions):
```go
// scanner_test.go
package main

import "testing"

func TestFilterVars(t *testing.T) {
    vars := map[string]string{
        "API_KEY": "value",
        "USERNAME": "value",  // Should be filtered out
    }

    result := filterVars(vars)

    if _, exists := result["API_KEY"]; !exists {
        t.Error("API_KEY should be present")
    }

    if _, exists := result["USERNAME"]; exists {
        t.Error("USERNAME should be filtered out")
    }
}
```

**Run command:**
```bash
go test -v ./...
```

## Test Environment Setup

**Vitest:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,        // Expose describe, it, expect globally
    environment: 'jsdom',   // Browser environment for DOM tests
    setupFiles: ['./src/core/setupTests.ts'],
    testTimeout: 10000,
  },
});
```

**Jest:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testTimeout: 10000,
};
```

## CI/CD Integration

**Observed patterns:**
- **Java/Gradle**: `./test.sh` script runs all Docker variants and tests
- **JavaScript/TypeScript**: No explicit CI configuration observed in analyzed files
- **Manual testing**: Documented in `CLAUDE.md` files for projects without formal test suites

---

*Testing analysis: 2026-02-23*
