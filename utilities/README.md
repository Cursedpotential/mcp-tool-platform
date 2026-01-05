# Utilities Toolkit

Complete conversation processing and analysis tools for MCP workflows.

## 🚀 Quickstart

```bash
# Parse ChatGPT export
python scripts/chatgpt_parser.py export.json

# Split large conversations
python scripts/conversation_splitter.py export.json --conversations-per-chunk 50

# Validate outputs
python scripts/output_schemas.py conversations.jsonl conversation

# Find duplicates
python scripts/find_duplicates.py ./data
```

## 📦 All Tools

### Core Parsers
- **chatgpt_parser.py** - Parse ChatGPT JSON exports → JSONL (entities, artifacts, turns)
- **conversation_splitter.py** - Split huge conversation files by count
- **batch_json_splitter.py** - Batch process multiple JSON files

### Analysis
- **compare_nltk_vs_agent.py** - Benchmark NLTK vs LLM sentiment analysis
- **nltk_vs_agent_comparison.py** - Detailed NLP accuracy testing
- **analyze_triggers.py** - Scan Claude skill triggers for anti-patterns

### Converters
- **conversation_to_docx.py** - JSONL → formatted DOCX reports
- **docx_to_pdf.py** - Batch DOCX → PDF conversion
- **clean_markdown_converter.py** - Markdown cleanup & conversion
- **convert_to_pdf.ps1** - PowerShell PDF converter

### Utilities
- **output_schemas.py** - Validate JSONL against schemas
- **find_duplicates.py** - Hash-based duplicate finder
- **chunk_file_tool.py** - Split large files into chunks
- **db_query_tool.js** - Simple database query executor

## 📊 Common Workflows

### Full Conversation Processing
```bash
# 1. Parse export
python scripts/chatgpt_parser.py huge_export.json ./output

# 2. Validate
python scripts/output_schemas.py output/conversations.jsonl conversation

# 3. Split if needed
python scripts/conversation_splitter.py output/conversations.jsonl

# 4. Convert to DOCX
python scripts/conversation_to_docx.py output/conversations.jsonl
```

### Batch Processing
```bash
# Process entire directory
python scripts/batch_json_splitter.py ./exports --chunk-size 50
```

## 🔧 Installation

```bash
git clone https://github.com/Cursedpotential/mcp-tool-platform
cd mcp-tool-platform/utilities

# Install Python dependencies
pip install spacy nltk
python -m spacy download en_core_web_sm

# Install Node.js dependencies (if using JS tools)
npm install
```

## 📝 Output Schemas

All tools produce validated JSONL with:
- **Conversations**: message_hash, platform, timestamp, turn_type, content
- **Entities**: entity_id, type, name, confidence, mention_count
- **Artifacts**: artifact_id, type, language, content, content_hash

See `output_schemas.py` for full validation rules.

## 🤖 MCP Integration

All tools work as atomic MCP tool calls:
```
mcp_tool_github-mcp-direct_create_or_update_file path="utilities/scripts/chatgpt_parser.py" ...
```

Agent-friendly CLI—no interactive prompts, pure stdio.

## 📚 Documentation

Each script has inline `--help` and docstrings. Example:
```bash
python scripts/chatgpt_parser.py --help
```

---

**Live Repo**: https://github.com/Cursedpotential/mcp-tool-platform/tree/main/utilities
