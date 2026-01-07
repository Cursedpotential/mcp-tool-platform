# Implementation Guide - Backend UI Skeleton

This document provides detailed instructions for completing the backend UI skeleton. All database schemas, tRPC routers, and UI pages have been scaffolded with clear TODOs.

---

## Overview

The skeleton includes:
1. **Database Schemas** (`drizzle/settings-schema.ts`) - 12 new tables for settings, LLM providers, workflows, agents, etc.
2. **tRPC Routers** - `server/routers/settings.ts` and `server/routers/patterns.ts` with 40+ procedures
3. **UI Pages** - `client/src/pages/PatternLibrary.tsx` with tabs, dialogs, and tables

---

## Step 1: Database Setup

### 1.1 Merge Settings Schema into Main Schema

Add imports to `drizzle/schema.ts`:

```typescript
// At the top of drizzle/schema.ts, add:
export * from "./settings-schema";
```

### 1.2 Push Schema to Database

```bash
cd /home/ubuntu/mcp-tool-platform
pnpm db:push
```

This will create all 12 new tables in the database.

---

## Step 2: Implement Database Helpers

### 2.1 Add Helpers to `server/db.ts`

For each table, add CRUD helpers. Example for `nlpConfig`:

```typescript
// Get NLP config for user (or default)
export async function getNlpConfig(userId: number) {
  const config = await db.query.nlpConfig.findFirst({
    where: eq(nlpConfig.userId, userId),
  });
  
  if (!config) {
    // Return defaults
    return {
      similarityThreshold: 75,
      timeGapMinutes: 30,
      chunkingStrategy: 'semantic',
      chunkSize: 512,
      chunkOverlap: 50,
    };
  }
  
  return config;
}

// Upsert NLP config
export async function upsertNlpConfig(userId: number, data: any) {
  const existing = await db.query.nlpConfig.findFirst({
    where: eq(nlpConfig.userId, userId),
  });
  
  if (existing) {
    return await db.update(nlpConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(nlpConfig.id, existing.id))
      .returning();
  } else {
    return await db.insert(nlpConfig)
      .values({ userId, ...data })
      .returning();
  }
}
```

Repeat for:
- `llmProviders` (list, add, update, delete)
- `llmRoutingRules` (list, upsert)
- `topicCodes` (list, add, update, delete)
- `platformCodes` (list, add, update, delete)
- `behavioralPatterns` (list with pagination, get by ID, add, update, delete)
- `patternCategories` (list, add, update, delete)

---

## Step 3: Implement tRPC Procedures

### 3.1 Settings Router (`server/routers/settings.ts`)

For each procedure with `throw new Error("TODO: ...")`:

1. Import the corresponding database helper from `server/db.ts`
2. Call the helper with `ctx.user.id`
3. Return the result

Example for `getNlpConfig`:

```typescript
getNlpConfig: protectedProcedure.query(async ({ ctx }) => {
  const config = await getNlpConfig(ctx.user.id);
  return config;
}),
```

Example for `updateNlpConfig`:

```typescript
updateNlpConfig: protectedProcedure
  .input(
    z.object({
      similarityThreshold: z.number().min(0).max(100),
      timeGapMinutes: z.number().min(1),
      chunkingStrategy: z.enum(['fixed_size', 'semantic', 'sliding_window', 'conversation_turn', 'paragraph']),
      chunkSize: z.number().min(128).max(2048),
      chunkOverlap: z.number().min(0).max(512),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const config = await upsertNlpConfig(ctx.user.id, input);
    return config;
  }),
```

### 3.2 Patterns Router (`server/routers/patterns.ts`)

Similar approach - replace all `throw new Error("TODO: ...")` with actual implementations.

Example for `list`:

```typescript
list: protectedProcedure
  .input(
    z.object({
      page: z.number().default(1),
      pageSize: z.number().default(50),
      search: z.string().optional(),
      category: z.string().optional(),
      severityMin: z.number().optional(),
      severityMax: z.number().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const { patterns, total } = await listPatterns(ctx.user.id, input);
    return {
      patterns,
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }),
```

### 3.3 API Key Encryption

For `addApiKey` and `updateApiKey`, you need to encrypt API keys before storing:

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-key-here';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

---

## Step 4: Wire Up UI Components

### 4.1 Pattern Library Page (`client/src/pages/PatternLibrary.tsx`)

1. **Uncomment tRPC queries:**
   ```typescript
   const { data: patternsData, isLoading } = trpc.patterns.list.useQuery({
     page: 1,
     pageSize: 50,
     search: searchQuery,
     category: selectedCategory,
   });
   
   const { data: categories } = trpc.patterns.getCategories.useQuery();
   const { data: stats } = trpc.patterns.getStats.useQuery();
   ```

2. **Uncomment mutations:**
   ```typescript
   const createPattern = trpc.patterns.create.useMutation({
     onSuccess: () => {
       toast.success("Pattern created");
       setIsAddDialogOpen(false);
     },
     onError: (error) => {
       toast.error(error.message);
     },
   });
   ```

3. **Wire form state:**
   ```typescript
   const [formData, setFormData] = useState({
     name: '',
     category: '',
     pattern: '',
     description: '',
     severity: 5,
     mclFactors: [],
     examples: [],
   });
   ```

4. **Populate table:**
   ```typescript
   <TableBody>
     {patternsData?.patterns.map((pattern) => (
       <TableRow key={pattern.id}>
         <TableCell>{pattern.name}</TableCell>
         <TableCell>{pattern.category}</TableCell>
         <TableCell>{pattern.severity}/10</TableCell>
         <TableCell>
           {pattern.mclFactors?.map(f => (
             <Badge key={f}>{f}</Badge>
           ))}
         </TableCell>
         <TableCell>{pattern.matchCount}</TableCell>
         <TableCell>
           {pattern.isCustom ? <Badge>Custom</Badge> : <Badge variant="outline">Built-in</Badge>}
         </TableCell>
         <TableCell className="text-right">
           <Button variant="ghost" size="sm" onClick={() => handleEdit(pattern)}>Edit</Button>
           <Button variant="ghost" size="sm" onClick={() => handleDelete(pattern.id)}>Delete</Button>
         </TableCell>
       </TableRow>
     ))}
   </TableBody>
   ```

5. **Add loading/empty states:**
   ```typescript
   {isLoading && <div>Loading...</div>}
   {!isLoading && patternsData?.patterns.length === 0 && (
     <div>No patterns found</div>
   )}
   ```

### 4.2 Settings Page (Already Exists)

The existing `client/src/pages/Settings.tsx` already has LLM provider management. You can:
1. Add a new tab for "Forensic Settings"
2. Add NLP configuration section
3. Add workflow configuration section

---

## Step 5: Register Routes

Add routes to `client/src/App.tsx`:

```typescript
import PatternLibrary from "@/pages/PatternLibrary";

// Inside <Routes>
<Route path="/patterns" element={<PatternLibrary />} />
```

Update sidebar navigation in `client/src/components/DashboardLayout.tsx`:

```typescript
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Pattern Library', href: '/patterns', icon: DatabaseIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];
```

---

## Step 6: Test Everything

### 6.1 Test Settings

1. Go to `/settings`
2. Test NLP configuration save
3. Test API key add/edit/delete
4. Test database connection tests

### 6.2 Test Pattern Library

1. Go to `/patterns`
2. Test pattern list with pagination
3. Test search and filters
4. Test add new pattern
5. Test edit pattern
6. Test delete pattern
7. Test pattern testing (regex against sample text)
8. Test import/export

---

## Step 7: Add Remaining UI Pages

### 7.1 LLM Router UI (`client/src/pages/LLMRouter.tsx`)

- Show routing rules table (task type → primary provider → fallback provider)
- Allow editing routing rules
- Show cost tracking charts (by provider, by task type)

### 7.2 Prompt Builder UI (`client/src/pages/PromptBuilder.tsx`)

- List all system prompts
- Allow editing prompt templates
- Show version history
- Allow testing prompts with sample data

### 7.3 Workflow Builder UI (`client/src/pages/WorkflowBuilder.tsx`)

- Visual workflow editor (drag-drop nodes)
- Node types: Document Upload, Parse, Analyze, Approve, Export
- Show workflow execution history

### 7.4 Agent Builder UI (`client/src/pages/AgentBuilder.tsx`)

- List all agents (forensic, document, approval, export)
- Allow creating custom agents
- Configure tools, memory, coordination

### 7.5 Import/Export UI (`client/src/pages/ImportExport.tsx`)

- Import patterns, workflows, agents, prompts
- Export analysis results, pattern library, etc.
- Show import/export history

---

## Step 8: Documentation

Once all UI is implemented, update documentation:

1. Take screenshots of each page
2. Add to `/docs/guides/backend-ui.md`
3. Update main README with links to backend UI docs

---

## Checklist

- [ ] Merge settings schema into main schema
- [ ] Push schema to database (`pnpm db:push`)
- [ ] Implement database helpers in `server/db.ts`
- [ ] Implement all tRPC procedures in `server/routers/settings.ts`
- [ ] Implement all tRPC procedures in `server/routers/patterns.ts`
- [ ] Wire up Pattern Library UI
- [ ] Add routes to App.tsx
- [ ] Update sidebar navigation
- [ ] Test Settings page
- [ ] Test Pattern Library page
- [ ] Create LLM Router UI
- [ ] Create Prompt Builder UI
- [ ] Create Workflow Builder UI
- [ ] Create Agent Builder UI
- [ ] Create Import/Export UI
- [ ] Add documentation with screenshots
- [ ] Save checkpoint

---

## Notes

- All TODOs are marked with `// TODO:` comments
- Use optimistic updates for list operations (add/edit/delete patterns)
- Add loading skeletons for better UX
- Add error handling for all mutations
- Add confirmation dialogs for destructive actions (delete)
- Add toast notifications for success/error feedback

---

## Questions?

If you encounter any issues:
1. Check the existing `Settings.tsx` for reference implementation
2. Check the template README for tRPC best practices
3. Check the database schema for field names and types
4. Use TypeScript errors to guide you - they'll tell you what's missing

---

**Good luck! 🚀**
