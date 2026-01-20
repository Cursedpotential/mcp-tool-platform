# TASK 01: Implement Pattern Router

**Priority:** CRITICAL  
**Estimated Time:** 2-3 hours  
**Delegate To:** Gemini 2.5 Flash or Groq Compound  
**Cost:** Low (bulk implementation task)

---

## Context

The Pattern Router (`server/api/routers/patterns.ts`) has all 13 endpoints stubbed with `throw new Error("TODO: Implement")`. This blocks the entire Pattern Library UI from functioning.

---

## Database Schema Reference

Tables to use (from `drizzle/schema.ts`):

### `behavioralPatterns`
```typescript
{
  id: int (autoincrement, primary key)
  userId: int (nullable, references users.id)
  name: varchar(255)
  category: varchar(100)
  pattern: text (regex pattern)
  description: text
  severity: int (1-10, default 5)
  mclFactors: text (JSON array as string)
  examples: text (JSON array as string)
  isActive: enum('true', 'false', default 'true')
  isCustom: enum('true', 'false', default 'false')
  matchCount: int (default 0)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### `patternCategories`
```typescript
{
  id: int (autoincrement, primary key)
  name: varchar(255)
  description: text
  color: varchar(50)
  icon: varchar(50)
  defaultSeverity: int (1-10)
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## Implementation Requirements

### 1. Import Database Helper
```typescript
import { getDb } from "../../core/db";
```

### 2. Implement All 13 Endpoints

#### `patterns.list`
- Query `behavioralPatterns` table
- Filter by `search` query (name, description)
- Filter by `category` if provided
- Filter by `severity` range if provided
- Include both custom patterns (`userId = ctx.user.id`) AND built-in patterns (`userId = null`)
- Return: `{ patterns: [...], total: number, page: number, pageSize: number }`

#### `patterns.getById`
- Fetch single pattern by ID
- Verify user has access (either owns it OR it's built-in with `userId = null`)
- Throw 403 if user doesn't own and it's not built-in
- Return pattern object

#### `patterns.create`
- Insert into `behavioralPatterns` table
- Set `userId = ctx.user.id`
- Set `isCustom = 'true'`
- Convert `mclFactors` and `examples` arrays to JSON strings using `JSON.stringify()`
- Return new pattern object

#### `patterns.update`
- Verify user owns this pattern (`userId = ctx.user.id`)
- Throw 403 if not owner
- Cannot update built-in patterns (`userId = null`)
- Update `behavioralPatterns` table
- Convert arrays to JSON strings if provided
- Return updated pattern object

#### `patterns.delete`
- Verify user owns this pattern (`userId = ctx.user.id`)
- Throw 403 if not owner
- Cannot delete built-in patterns (`userId = null`)
- Delete from `behavioralPatterns` table
- Return `{ success: true }`

#### `patterns.testPattern`
- Test regex pattern against sample text
- Use `new RegExp(pattern, 'gi')` for case-insensitive global matching
- Return `{ matches: [...], matchCount: number }`
- Handle regex errors gracefully (invalid regex syntax)

#### `patterns.import`
- Iterate through patterns array
- Check for existing patterns with same name
- Handle conflicts based on `conflictResolution` strategy:
  - `skip`: Skip existing patterns
  - `overwrite`: Update existing patterns
  - `rename`: Append suffix to name (e.g., " (imported)")
- Insert new patterns or update existing ones
- Log import to `importHistory` table (if exists, otherwise skip logging)
- Return `{ imported: number, skipped: number, errors: [...] }`

#### `patterns.export`
- Fetch all patterns for current user
- Optionally include built-in patterns if `includeBuiltIn = true`
- Convert to requested format:
  - `json`: Return JSON array
  - `csv`: Convert to CSV format
- Log export to `exportHistory` table (if exists, otherwise skip logging)
- Return file data or download URL

#### `patterns.getStats`
- Fetch pattern usage statistics
- Group by category
- Calculate:
  - `totalPatterns`: Total count
  - `customPatterns`: Count where `userId = ctx.user.id`
  - `builtInPatterns`: Count where `userId = null`
  - `byCategory`: Object with category counts
  - `topMatched`: Top 10 patterns by `matchCount`
- Return stats object

#### `patterns.getCategories`
- Fetch all pattern categories from `patternCategories` table
- Include pattern count per category (JOIN with `behavioralPatterns`)
- Return array of `{ id, name, description, color, icon, defaultSeverity, patternCount }`

#### `patterns.createCategory`
- Insert into `patternCategories` table
- Return new category object

#### `patterns.updateCategory`
- Update `patternCategories` table
- Return updated category object

#### `patterns.deleteCategory`
- Check if category has patterns (COUNT from `behavioralPatterns` WHERE `category = name`)
- If yes, throw error: "Cannot delete category with existing patterns"
- Delete from `patternCategories` table
- Return `{ success: true }`

---

## Database Query Examples

### Using Drizzle ORM
```typescript
const db = await getDb();

// SELECT with filter
const patterns = await db.select()
  .from(behavioralPatterns)
  .where(
    and(
      or(
        eq(behavioralPatterns.userId, ctx.user.id),
        isNull(behavioralPatterns.userId)
      ),
      eq(behavioralPatterns.isActive, 'true')
    )
  )
  .limit(input.pageSize)
  .offset((input.page - 1) * input.pageSize);

// INSERT
const [newPattern] = await db.insert(behavioralPatterns)
  .values({
    userId: ctx.user.id,
    name: input.name,
    category: input.category,
    pattern: input.pattern,
    description: input.description,
    severity: input.severity,
    mclFactors: JSON.stringify(input.mclFactors || []),
    examples: JSON.stringify(input.examples || []),
    isCustom: 'true',
    isActive: 'true',
  })
  .returning();

// UPDATE
const [updated] = await db.update(behavioralPatterns)
  .set({
    name: input.name,
    pattern: input.pattern,
    updatedAt: new Date(),
  })
  .where(eq(behavioralPatterns.id, input.id))
  .returning();

// DELETE
await db.delete(behavioralPatterns)
  .where(eq(behavioralPatterns.id, input.id));
```

---

## Error Handling

- Use `TRPCError` for errors:
```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'You do not own this pattern',
});
```

- Common error codes:
  - `NOT_FOUND`: Pattern/category not found
  - `FORBIDDEN`: User doesn't have permission
  - `BAD_REQUEST`: Invalid input (e.g., invalid regex)
  - `INTERNAL_SERVER_ERROR`: Database errors

---

## Testing Checklist

After implementation, test:
- [ ] Can list patterns (both custom and built-in)
- [ ] Can create new pattern
- [ ] Can update own pattern
- [ ] Cannot update someone else's pattern
- [ ] Cannot update built-in pattern
- [ ] Can delete own pattern
- [ ] Cannot delete someone else's pattern
- [ ] Cannot delete built-in pattern
- [ ] Can test regex pattern
- [ ] Invalid regex throws error
- [ ] Can import patterns with conflict resolution
- [ ] Can export patterns as JSON
- [ ] Can view statistics
- [ ] Can list categories with pattern counts
- [ ] Can create/update/delete categories
- [ ] Cannot delete category with patterns

---

## Files to Modify

1. `server/api/routers/patterns.ts` - Main implementation file

---

## Output Format

Provide the complete updated `patterns.ts` file with all implementations.
