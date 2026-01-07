# Google Drive Utilities Analysis

**Date**: January 5, 2026  
**Source**: `04_Utilities` folder  
**Purpose**: Identify reusable code for MCP Tool Platform integration

---

## Overview

Analyzed 40+ Python and JavaScript scripts from the user's Google Drive. These are custom tools built for forensic analysis, document processing, and conversation parsing—all highly relevant to the MCP Tool Platform's preprocessing goals.

---

## High-Value Scripts for Integration

### 1. **chatgpt_parser.py** (24KB)

**Purpose**: Parse ChatGPT conversation exports into structured data.

**Key Features**:
- Extracts messages, timestamps, roles
- Handles multi-turn conversations
- Outputs structured JSON

**Integration Opportunity**:
- Add as `forensics.parse_chatgpt_export` tool
- Wire to document intelligence schema
- Enable timeline reconstruction from chat logs

**Reusability**: ⭐⭐⭐⭐⭐ (Directly applicable)

---

### 2. **forensic_diff.py** (4.9KB)

**Purpose**: Compare two versions of a document/conversation and highlight changes.

**Key Features**:
- Line-by-line diff with timestamps
- Detects additions, deletions, modifications
- Useful for evidence chain verification

**Integration Opportunity**:
- Add as `forensics.compare_versions` tool
- Integrate with `evidenceChains` table
- Support temporal contradiction detection

**Reusability**: ⭐⭐⭐⭐⭐ (Core forensic feature)

---

### 3. **chunk_file_tool.py** (9KB)

**Purpose**: Intelligently chunk large files for LLM processing.

**Key Features**:
- Semantic chunking (not just character count)
- Preserves context across boundaries
- Configurable chunk size and overlap

**Integration Opportunity**:
- Enhance existing `document.chunk` tool
- Replace naive chunking with semantic approach
- Integrate with Chroma for chunk embeddings

**Reusability**: ⭐⭐⭐⭐⭐ (Improves token efficiency)

---

### 4. **conversation_to_docx.py** (11KB)

**Purpose**: Convert conversation JSON to formatted Word documents.

**Key Features**:
- Preserves formatting, timestamps, roles
- Generates table of contents
- Exports to DOCX

**Integration Opportunity**:
- Add as `format_converter.json_to_docx` tool
- Complement existing format conversion tools
- Enable export workflows

**Reusability**: ⭐⭐⭐⭐ (Useful for reporting)

---

### 5. **compare_nltk_vs_agent.py** (12KB)

**Purpose**: Benchmark NLTK vs. custom agent for NLP tasks.

**Key Features**:
- Compares tokenization, NER, sentiment
- Measures accuracy and performance
- Generates comparison reports

**Integration Opportunity**:
- Use as validation tool for NLP handlers
- Add as `nlp.benchmark` tool
- Help users choose best NLP approach

**Reusability**: ⭐⭐⭐⭐ (Quality assurance)

---

### 6. **output_schemas.py** (14KB)

**Purpose**: Generate JSON schemas from sample data.

**Key Features**:
- Infers schema from examples
- Validates data against schema
- Exports to JSON Schema format

**Integration Opportunity**:
- Add as `schema_resolver.infer_schema` tool
- Complement existing schema resolution
- Enable auto-schema generation

**Reusability**: ⭐⭐⭐⭐⭐ (Schema automation)

---

### 7. **pandoc_toolkit.py** (19KB)

**Purpose**: Comprehensive document conversion using Pandoc.

**Key Features**:
- Supports 20+ formats (MD, DOCX, PDF, HTML, LaTeX)
- Batch conversion
- Template support

**Integration Opportunity**:
- Enhance `format_converter` plugin
- Add Pandoc as optional backend
- Support more formats

**Reusability**: ⭐⭐⭐⭐ (Format flexibility)

---

### 8. **file_analyzer.py** (8.6KB)

**Purpose**: Deep file analysis (metadata, structure, content preview).

**Key Features**:
- Detects file type, encoding, size
- Extracts metadata (EXIF, PDF info, etc.)
- Generates file fingerprint

**Integration Opportunity**:
- Add as `forensics.analyze_file` tool
- Integrate with evidence chain
- Support provenance tracking

**Reusability**: ⭐⭐⭐⭐⭐ (Forensic core)

---

### 9. **find_duplicates.py** (2.7KB)

**Purpose**: Find duplicate files using content hashing.

**Key Features**:
- MD5/SHA256 hashing
- Fuzzy matching for near-duplicates
- Batch processing

**Integration Opportunity**:
- Add as `forensics.find_duplicates` tool
- Integrate with evidence deduplication
- Support semantic deduplication via Chroma

**Reusability**: ⭐⭐⭐⭐ (Evidence cleanup)

---

### 10. **json_splitter.py** + **batch_json_splitter.py** (7.6KB + 5.4KB)

**Purpose**: Split large JSON files into manageable chunks.

**Key Features**:
- Preserves structure
- Configurable split strategy (by size, by key, by array)
- Batch processing

**Integration Opportunity**:
- Add as `document.split_json` tool
- Support large dataset preprocessing
- Enable parallel processing

**Reusability**: ⭐⭐⭐⭐ (Scalability)

---

## Medium-Value Scripts

### Document Conversion Tools

| Script | Purpose | Integration |
|--------|---------|-------------|
| `clean_markdown_converter.py` | Clean MD conversion | Enhance `format_converter.parse_markdown` |
| `markdown_to_pdf.py` | MD to PDF | Add PDF export option |
| `docx_to_pdf.py` | DOCX to PDF | Add PDF export option |
| `improved_md_to_pdf.py` | Better MD to PDF | Replace naive implementation |

**Reusability**: ⭐⭐⭐ (Nice-to-have exports)

---

### JSON Processing Tools

| Script | Purpose | Integration |
|--------|---------|-------------|
| `json_merger.py` | Merge split JSON | Complement `json_splitter` |
| `simple_json_splitter.py` | Simpler JSON split | Fallback for `json_splitter` |
| `json_to_markdown.py` | JSON to MD | Add to format converters |

**Reusability**: ⭐⭐⭐ (Workflow completion)

---

### Conversation Processing Tools

| Script | Purpose | Integration |
|--------|---------|-------------|
| `conversation_splitter.py` | Split conversations | Add to `forensics` |
| `robust_conversation_extractor.py` | Extract from exports | Add to `forensics` |
| `process_real_session.py` | Process session data | Add to `forensics` |

**Reusability**: ⭐⭐⭐ (Forensic workflows)

---

## Low-Value Scripts (Skip)

| Script | Reason |
|--------|--------|
| `organize_downloads_smart.py` | Filesystem organization (not preprocessing) |
| `unzip_and_organize.py` | File management (not preprocessing) |
| `ssh_cmd.py` | Infrastructure (not preprocessing) |
| `test_*.py` | Test scripts (not tools) |
| `fix_triggers.py` | Database maintenance (specific to user's DB) |
| `analyze_triggers.py` | Database analysis (specific to user's DB) |

---

## Integration Priority

### P0 (Immediate Integration)

1. **chatgpt_parser.py** → `forensics.parse_chatgpt_export`
2. **forensic_diff.py** → `forensics.compare_versions`
3. **chunk_file_tool.py** → Enhance `document.chunk`
4. **file_analyzer.py** → `forensics.analyze_file`
5. **output_schemas.py** → `schema_resolver.infer_schema`

### P1 (Next Sprint)

6. **find_duplicates.py** → `forensics.find_duplicates`
7. **json_splitter.py** → `document.split_json`
8. **pandoc_toolkit.py** → Enhance `format_converter`
9. **compare_nltk_vs_agent.py** → `nlp.benchmark`
10. **conversation_to_docx.py** → `format_converter.json_to_docx`

### P2 (Future)

11. All markdown/PDF converters
12. JSON processing tools (merger, simple splitter)
13. Conversation processing tools

---

## Implementation Strategy

### Step 1: Copy to `server/python-tools/`

```bash
cp /tmp/drive-analysis/chatgpt_parser.py server/python-tools/
cp /tmp/drive-analysis/forensic_diff.py server/python-tools/
cp /tmp/drive-analysis/chunk_file_tool.py server/python-tools/
cp /tmp/drive-analysis/file_analyzer.py server/python-tools/
cp /tmp/drive-analysis/output_schemas.py server/python-tools/
```

### Step 2: Wrap in Python Bridge

Create `server/python-tools/forensics_runner.py`:

```python
import sys
import json
from chatgpt_parser import parse_export
from forensic_diff import compare_versions
from file_analyzer import analyze_file

def main():
    command = sys.argv[1]
    args = json.loads(sys.argv[2])
    
    if command == 'parse_chatgpt':
        result = parse_export(args['file_path'])
    elif command == 'compare_versions':
        result = compare_versions(args['file1'], args['file2'])
    elif command == 'analyze_file':
        result = analyze_file(args['file_path'])
    else:
        result = {'error': 'Unknown command'}
    
    print(json.dumps(result))

if __name__ == '__main__':
    main()
```

### Step 3: Register Handlers in Executor

```typescript
this.registerHandler('forensics.parse_chatgpt_export', async (args) => {
  const result = await callPython('parse_chatgpt', {
    file_path: args.filePath
  });
  return result.data;
});

this.registerHandler('forensics.compare_versions', async (args) => {
  const result = await callPython('compare_versions', {
    file1: args.file1,
    file2: args.file2
  });
  return result.data;
});

this.registerHandler('forensics.analyze_file', async (args) => {
  const result = await callPython('analyze_file', {
    file_path: args.filePath
  });
  return result.data;
});
```

### Step 4: Register Tools in Registry

```typescript
registry.registerTool({
  name: 'forensics.parse_chatgpt_export',
  category: 'forensics',
  description: 'Parse ChatGPT conversation export into structured timeline',
  version: '1.0.0',
  tags: ['forensics', 'chatgpt', 'conversation', 'timeline'],
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to ChatGPT export file' }
    },
    required: ['filePath']
  },
  outputSchema: {
    type: 'object',
    properties: {
      messages: { type: 'array' },
      timeline: { type: 'array' },
      participants: { type: 'array' }
    }
  },
  permissions: ['read:filesystem']
});
```

---

## Workspace Indexer Analysis

Found `Workspace_Indexer/` folder with TypeScript MCP server:

**Files**:
- `mcp-server.ts` - MCP server implementation
- `indexer.ts` - Workspace indexing logic
- `search.ts` - Full-text search
- `summarizer.ts` - Document summarization
- `embeddings.ts` - Vector embeddings
- `db.ts` - SQLite database

**Purpose**: Index local workspace, enable semantic search.

**Integration Opportunity**:
- This is a **complete MCP server** for filesystem indexing
- Could be deployed as a remote MCP server
- Or: Extract core logic and integrate into platform

**Reusability**: ⭐⭐⭐⭐ (Filesystem indexing feature)

---

## MCP Tools Analysis

Found `MCP_Tools/` folder with agent configs:

**Tools**:
- `file_investigator` - Deep file analysis
- `text_miner` - Text extraction and analysis
- `doc_alchemist` - Document transformation
- `json_surgeon` - JSON manipulation

**Format**: Claude/Gemini prompt configs

**Integration Opportunity**:
- These are **prompt templates** for agents
- Extract tool logic and implement as handlers
- Use prompts as documentation

**Reusability**: ⭐⭐⭐ (Inspiration for tool design)

---

## Recommendations

### Immediate Actions

1. **Copy P0 scripts** to `server/python-tools/`
2. **Create forensics_runner.py** wrapper
3. **Register 5 new handlers** in executor
4. **Register 5 new tools** in registry
5. **Write tests** for each new tool

### Future Work

1. **Deploy Workspace Indexer** as remote MCP server
2. **Extract logic** from MCP Tools prompts
3. **Integrate P1 scripts** (duplicates, JSON splitter, Pandoc)
4. **Add P2 scripts** as optional enhancements

### Documentation

1. **Update ARCHITECTURE.md** with new tools
2. **Add to todo.md** as completed items
3. **Create UTILITIES_README.md** in `server/python-tools/`

---

## Conclusion

The Google Drive utilities are a **goldmine** of forensic and preprocessing logic. Integrating the P0 scripts will add 5 high-value tools to the platform with minimal effort. The Workspace Indexer is a complete MCP server that could be deployed separately or integrated directly.

**Next Steps**: Begin P0 integration (Phase 3).
