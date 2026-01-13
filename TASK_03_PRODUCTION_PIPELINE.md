# TASK 03: Complete Production Pipeline

**Priority:** HIGH  
**Estimated Time:** 1-2 hours  
**Delegate To:** Groq Llama 3.3 70B  
**Cost:** Free

---

## Context

The Production Pipeline (`server/mcp/pipelines/production-pipeline.ts`) has 4 incomplete implementations marked with TODO comments. These gaps prevent full end-to-end document processing.

---

## Gaps to Fix

### 1. `extractEntities()` - Line 271
**Current:** Returns empty array with TODO comment

**Implementation:**
```typescript
private async extractEntities(messages: any[]): Promise<any[]> {
  const entities: any[] = [];
  
  // Use compromise.js for lightweight NER (no Python dependency)
  const nlp = require('compromise');
  
  for (const msg of messages) {
    if (!msg.text) continue;
    
    const doc = nlp(msg.text);
    
    // Extract people
    const people = doc.people().out('array');
    people.forEach((person: string) => {
      entities.push({
        type: 'PERSON',
        value: person,
        messageId: msg.id,
        confidence: 0.8,
      });
    });
    
    // Extract places
    const places = doc.places().out('array');
    places.forEach((place: string) => {
      entities.push({
        type: 'LOCATION',
        value: place,
        messageId: msg.id,
        confidence: 0.7,
      });
    });
    
    // Extract dates
    const dates = doc.dates().out('array');
    dates.forEach((date: string) => {
      entities.push({
        type: 'DATE',
        value: date,
        messageId: msg.id,
        confidence: 0.9,
      });
    });
    
    // Extract organizations
    const orgs = doc.organizations().out('array');
    orgs.forEach((org: string) => {
      entities.push({
        type: 'ORGANIZATION',
        value: org,
        messageId: msg.id,
        confidence: 0.7,
      });
    });
  }
  
  // Deduplicate entities
  const uniqueEntities = Array.from(
    new Map(entities.map(e => [`${e.type}_${e.value}`, e])).values()
  );
  
  return uniqueEntities;
}
```

**Alternative (if Python bridge is available):**
```typescript
private async extractEntities(messages: any[]): Promise<any[]> {
  const { callPython } = await import('../python-bridge');
  
  const texts = messages.map(m => m.text).filter(Boolean);
  
  const result = await callPython('extract_entities', {
    texts,
    model: 'en_core_web_sm',
  });
  
  if (result.success && result.data) {
    return result.data.entities || [];
  }
  
  // Fallback to compromise.js if Python fails
  return this.extractEntitiesWithCompromise(messages);
}
```

---

### 2. `insertEntitiesIntoNeo4j()` - Line 449
**Current:** Only logs, doesn't actually insert

**Implementation:**
```typescript
private async insertEntitiesIntoNeo4j(entities: any[], documentId: string): Promise<void> {
  if (entities.length === 0) {
    console.log('No entities to insert into Neo4j');
    return;
  }
  
  try {
    // Use Graphiti client for entity storage
    for (const entity of entities) {
      await graphitiClient.addEntity({
        name: entity.value,
        type: entity.type,
        metadata: {
          documentId,
          messageId: entity.messageId,
          confidence: entity.confidence,
          extractedAt: new Date().toISOString(),
        },
      });
    }
    
    console.log(`✅ Inserted ${entities.length} entities into Neo4j for document ${documentId}`);
  } catch (error) {
    console.error('Failed to insert entities into Neo4j:', error);
    // Don't throw - entity insertion is non-critical
  }
}
```

---

### 3. `detectDirection()` - Line 483
**Current:** Returns 'unknown' for all messages

**Implementation:**
```typescript
private detectDirection(sender: string): string {
  // Known user identifiers (Matt Salem)
  const userIdentifiers = [
    'matt salem',
    'matthew salem',
    'matt',
    'salem',
    'me',
    'you', // In some exports, user is "you"
  ];
  
  const senderLower = sender.toLowerCase().trim();
  
  // Check if sender matches known user
  for (const identifier of userIdentifiers) {
    if (senderLower.includes(identifier)) {
      return 'outgoing';
    }
  }
  
  // If not user, it's incoming
  return 'incoming';
}
```

**Better implementation (with database lookup):**
```typescript
private async detectDirection(sender: string, userId: string): Promise<string> {
  // Query user's known identifiers from database
  const { data: userProfile } = await supabaseManager['client']
    .from('user_profiles')
    .select('known_identifiers')
    .eq('user_id', userId)
    .single();
  
  if (userProfile && userProfile.known_identifiers) {
    const identifiers = userProfile.known_identifiers as string[];
    const senderLower = sender.toLowerCase().trim();
    
    for (const identifier of identifiers) {
      if (senderLower.includes(identifier.toLowerCase())) {
        return 'outgoing';
      }
    }
  }
  
  // Fallback to hardcoded identifiers
  const defaultIdentifiers = ['matt salem', 'matthew salem', 'matt', 'me', 'you'];
  const senderLower = sender.toLowerCase().trim();
  
  for (const identifier of defaultIdentifiers) {
    if (senderLower.includes(identifier)) {
      return 'outgoing';
    }
  }
  
  return 'incoming';
}
```

---

### 4. Extract Matched Text in `extractBehaviors()` - Line 321
**Current:** Uses pattern name instead of actual matched text

**Implementation:**
```typescript
// Inside extractBehaviors() method, around line 310-325
const behaviors: any[] = [];

for (const msg of messages) {
  if (!msg.classifications || msg.classifications.length === 0) continue;
  
  for (const pattern of msg.classifications) {
    // Extract actual matched text from message
    let matchedText = pattern.name; // Fallback
    
    try {
      // Try to find the actual match using regex
      const regex = new RegExp(pattern.pattern || '', 'gi');
      const matches = msg.text.match(regex);
      if (matches && matches.length > 0) {
        matchedText = matches[0]; // First match
      }
    } catch (e) {
      // Invalid regex, use pattern name
    }
    
    behaviors.push({
      message_id: msg.id,
      category: pattern.category,
      subcategory: pattern.name,
      matchedPattern: pattern.name,
      matchedText: matchedText, // Now uses actual matched text
      confidence: pattern.score / 10,
      severity: this.mapSeverity(pattern.score),
      context_before: '', // TODO: Extract context
      context_after: '',
    });
  }
}

return behaviors;
```

---

### 5. Wire Directus R2 Upload - Line 172
**Current:** TODO comment, uses Supabase instead

**Implementation:**
```typescript
private async uploadRawFile(filePath: string, userId: string): Promise<any> {
  const fileBuffer = await readFile(filePath);
  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
  const fileName = path.basename(filePath);
  const fileSize = fileBuffer.length;
  const fileType = this.detectFileType(fileName);
  
  // Upload to R2 via Supabase Storage
  const r2Path = `documents/${fileHash}/${fileName}`;
  
  try {
    const { data: uploadData, error: uploadError } = await supabaseManager['client']
      .storage
      .from('evidence-files') // R2 bucket name
      .upload(r2Path, fileBuffer, {
        contentType: this.getContentType(fileType),
        upsert: false,
      });
    
    if (uploadError) {
      console.error('R2 upload failed:', uploadError);
      // Continue anyway, store metadata
    }
  } catch (error) {
    console.error('R2 upload error:', error);
    // Non-fatal, continue
  }
  
  // Create document record in Supabase
  const { data, error } = await supabaseManager['client']
    .from('messaging_documents')
    .insert({
      filename: fileName,
      file_hash: fileHash,
      file_size: fileSize,
      file_type: fileType,
      source_platform: this.detectSourcePlatform(fileType),
      acquired_by: 'Matt Salem',
      acquired_date: new Date().toISOString(),
      acquisition_method: 'User upload via MCP Tool Platform',
      storage_path: r2Path,
    })
    .select()
    .single();
  
  if (error) throw new Error(`Failed to create document record: ${error.message}`);
  return data;
}

private getContentType(fileType: string): string {
  const contentTypes: Record<string, string> = {
    'facebook_html': 'text/html',
    'xml_sms': 'application/xml',
    'pdf_imessage': 'application/pdf',
  };
  return contentTypes[fileType] || 'application/octet-stream';
}
```

---

## Additional Improvements

### Add compromise.js import
```typescript
import nlp from 'compromise';
```

### Update detectDirection calls
Since detectDirection now needs userId, update all calls:
```typescript
// Line 396, inside insertIntoSupabase()
direction: await this.detectDirection(msg.sender, documentRecord.user_id),
```

---

## Dependencies to Install

```bash
cd /home/ubuntu/mcp-tool-platform
pnpm add compromise
```

---

## Testing Checklist

After implementation, test:
- [ ] Entity extraction returns people, places, dates, orgs
- [ ] Entities are inserted into Neo4j via Graphiti
- [ ] Direction detection correctly identifies outgoing messages
- [ ] Matched text is extracted from patterns (not just pattern name)
- [ ] R2 upload works via Supabase Storage
- [ ] Pipeline completes end-to-end without errors

---

## Files to Modify

1. `server/mcp/pipelines/production-pipeline.ts` - Main implementation file

---

## Output Format

Provide the complete updated `production-pipeline.ts` file with all implementations.
