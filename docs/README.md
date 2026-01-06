# Salem Forensic Trinity - Documentation

**Project:** MCP Tool Platform for Forensic Analysis  
**Version:** 1.0.0  
**Last Updated:** January 6, 2026  

---

## Overview

Salem Forensic Trinity is a **forensic analysis platform for custody case evidence processing**. It ingests multi-platform messaging data (SMS, Facebook, iMessage, email, ChatGPT), performs multi-pass NLP classification to detect psychological abuse patterns (gaslighting, DARVO, parental alienation), and exports to multiple databases with court-admissible audit trails.

**Core Capabilities:**
- Multi-platform document parsing (SMS XML, Facebook HTML, iMessage PDF, Email, ChatGPT)
- 6-pass NLP classification system (spaCy, NLTK, TextBlob, Pattern Analyzer, Sentence Transformers, Aggregation)
- 256-pattern behavioral library (gaslighting, DARVO, parental alienation, substance abuse, etc.)
- Dual-polarity analysis (detect both negative abuse patterns AND positive love-bombing patterns)
- Multi-database export (Supabase for messages, Neo4j/Graphiti for entities, R2/Directus for raw files)
- Court-admissible audit trails (SHA-256 hashing, immutable logs, chain of custody)
- Human-in-the-loop checkpoints (preliminary approval, meta-analysis approval)

---

## Quick Links

### Getting Started
- [Quick Start Guide](./GETTING_STARTED.md) - Get up and running in 5 minutes
- [Installation](./INSTALLATION.md) - Detailed setup instructions
- [Configuration](./CONFIGURATION.md) - Environment variables and settings
- [Architecture Overview](./ARCHITECTURE.md) - System design and data flow

### User Guides
- [Uploading Documents](./guides/uploading-documents.md) - How to upload evidence files
- [Running Analysis](./guides/running-analysis.md) - How to trigger forensic analysis
- [Managing Patterns](./guides/managing-patterns.md) - How to customize behavioral patterns
- [Exporting Results](./guides/exporting-results.md) - How to generate reports
- [Court Admissibility](./guides/court-admissibility.md) - Ensuring evidence is court-ready

### API Reference
- [MCP Gateway API](./api/mcp-gateway.md) - Tool discovery and invocation
- [tRPC Procedures](./api/trpc-procedures.md) - Backend API reference
- [WebSocket API](./api/websocket-api.md) - Real-time log streaming
- [Authentication](./api/authentication.md) - OAuth and session management

---

## Tools Reference

### Search Tools
- [Web Search](./tools/search-web.md) - General web search
- [Semantic Search](./tools/search-semantic.md) - Vector-based similarity search
- [Tavily Search](./tools/search-tavily.md) - LLM-optimized search
- [Perplexity Search](./tools/search-perplexity.md) - AI-powered search

### Document Tools
- [Document Parser](./tools/document-parse.md) - Multi-format document parsing
- [OCR Tool](./tools/document-ocr.md) - Optical character recognition
- [Text Extraction](./tools/document-extract.md) - Extract text from documents
- [Document Chunking](./tools/document-chunk.md) - Split documents into chunks

### NLP Tools
- [Sentiment Analysis](./tools/nlp-sentiment.md) - Analyze sentiment
- [Entity Extraction](./tools/nlp-entities.md) - Extract named entities
- [Text Classification](./tools/nlp-classify.md) - Classify text into categories
- [Summarization](./tools/nlp-summarize.md) - Generate summaries
- [spaCy Integration](./tools/nlp-spacy.md) - Entity extraction, structure analysis
- [NLTK Integration](./tools/nlp-nltk.md) - VADER sentiment, negation handling
- [TextBlob Integration](./tools/nlp-textblob.md) - Polarity, subjectivity, sarcasm
- [Sentence Transformers](./tools/nlp-transformers.md) - Semantic similarity

### Forensics Tools
- [Pattern Analysis](./tools/forensics-analyze-patterns.md) - Detect 256 behavioral patterns
- [HurtLex Detection](./tools/forensics-detect-hurtlex.md) - Offensive language detection
- [Severity Scoring](./tools/forensics-score-severity.md) - Score abuse severity (1-10)
- [Analysis Modules](./tools/forensics-get-modules.md) - Get 17 analysis modules
- [Multi-Pass Classifier](./tools/forensics-multi-pass-classifier.md) - 6-pass NLP classification
- [Priority Screener](./tools/forensics-priority-screener.md) - Pass 0: Immediate flags

### Vector Database Tools
- [Add Embeddings](./tools/vector-add.md) - Store embeddings in vector DB
- [Semantic Search](./tools/vector-search.md) - Search by semantic similarity
- [Delete Embeddings](./tools/vector-delete.md) - Remove embeddings
- [Chroma Integration](./tools/vector-chroma.md) - 72hr TTL working memory
- [pgvector Integration](./tools/vector-pgvector.md) - Supabase persistent storage
- [Qdrant Integration](./tools/vector-qdrant.md) - Qdrant vector DB

### Graph Database Tools
- [Add Entity](./tools/graph-add-entity.md) - Add entity to knowledge graph
- [Add Relationship](./tools/graph-add-relationship.md) - Add relationship between entities
- [Search Entities](./tools/graph-search-entities.md) - Query entities
- [Entity Timeline](./tools/graph-timeline.md) - Get entity history
- [Detect Contradictions](./tools/graph-contradictions.md) - Find conflicting statements
- [Neo4j Integration](./tools/graph-neo4j.md) - Neo4j graph database
- [Graphiti Integration](./tools/graph-graphiti.md) - Temporal knowledge graphs

### LLM Tools
- [Invoke LLM](./tools/llm-invoke.md) - Call language models
- [Generate Embeddings](./tools/llm-embed.md) - Create text embeddings
- [Smart Router](./tools/llm-smart-router.md) - Route to optimal LLM provider
- [LLM Providers](./tools/llm-providers.md) - Supported providers overview

### Format Conversion Tools
- [Format Converter](./tools/format-convert.md) - Convert between formats
- [Format Parser](./tools/format-parse.md) - Parse SMS XML, Facebook HTML, etc.
- [Schema Validation](./tools/format-check-schema.md) - Validate data schemas
- [OCR Tool](./tools/format-ocr.md) - Extract text from images

### Evidence Chain Tools
- [Create Chain](./tools/evidence-create-chain.md) - Start evidence chain
- [Add Stage](./tools/evidence-add-stage.md) - Add processing stage
- [Verify Integrity](./tools/evidence-verify.md) - Verify chain integrity
- [Hash File](./tools/evidence-hash-file.md) - SHA-256 file hashing
- [Hash Content](./tools/evidence-hash-content.md) - SHA-256 content hashing
- [Export Chain](./tools/evidence-export.md) - Export evidence chain
- [Generate Report](./tools/evidence-report.md) - Create evidence report

### Other Tools
- [Text Mining](./tools/text-mine.md) - Advanced text search (ugrep/ripgrep)
- [Schema Resolution](./tools/schema-resolve.md) - Resolve data schemas
- [Schema Application](./tools/schema-apply.md) - Apply schemas to data
- [Schema Caching](./tools/schema-cache.md) - Cache resolved schemas

---

## Workflows

- [Forensic Investigation](./workflows/forensic-investigation.md) - 8-stage end-to-end workflow
- [Document Processing](./workflows/document-processing.md) - Parse and validate documents
- [Document Analysis](./workflows/document-analysis.md) - Analyze document content
- [Forensic Chat Analysis](./workflows/forensic-chat-analysis.md) - Analyze messaging data
- [Semantic Search Prep](./workflows/semantic-search-prep.md) - Prepare embeddings
- [Data Extraction Pipeline](./workflows/data-extraction-pipeline.md) - Extract structured data
- [Text Mining Workflow](./workflows/text-mining-workflow.md) - Mine text for patterns
- [Format Conversion Chain](./workflows/format-conversion-chain.md) - Convert formats

---

## System Components

- [MCP Gateway](./systems/mcp-gateway.md) - Tool discovery and invocation API
- [Plugin System](./systems/plugin-system.md) - Plugin architecture
- [Tool Executor](./systems/executor.md) - Tool execution engine
- [Smart Router](./systems/smart-router.md) - LLM provider routing
- [Chroma Storage](./systems/chroma-storage.md) - 72hr TTL working memory
- [Supabase Integration](./systems/supabase-integration.md) - Message storage
- [Neo4j Integration](./systems/neo4j-integration.md) - Entity graph storage
- [R2/Directus Storage](./systems/r2-directus-storage.md) - Raw file storage
- [LangGraph State Machines](./systems/langgraph-state-machines.md) - Workflow orchestration
- [LangChain Memory](./systems/langchain-memory.md) - Hypothesis tracking
- [LlamaIndex Loaders](./systems/llamaindex-loaders.md) - Document loaders
- [Multi-Pass Classifier](./systems/multi-pass-classifier.md) - 6-pass NLP system
- [Pattern Library](./systems/pattern-library.md) - 256 behavioral patterns
- [Embedding Pipeline](./systems/embedding-pipeline.md) - Embedding generation
- [Audit Logging](./systems/audit-logging.md) - Chain of custody
- [HITL Checkpoints](./systems/hitl-checkpoints.md) - Human approval gates

---

## Developer Documentation

- [Contributing](./CONTRIBUTING.md) - How to contribute
- [Development Setup](./DEVELOPMENT.md) - Local development guide
- [Testing Guide](./TESTING.md) - Writing and running tests
- [Code Style](./CODE_STYLE.md) - Coding standards
- [Plugin Development](./PLUGIN_DEVELOPMENT.md) - Creating plugins
- [Tool Development](./TOOL_DEVELOPMENT.md) - Creating tools

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-org/salem-forensic-trinity/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/salem-forensic-trinity/discussions)
- **Email:** support@salemforensic.com

---

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## Acknowledgments

- **spaCy** - Industrial-strength NLP
- **NLTK** - Natural Language Toolkit
- **TextBlob** - Simplified text processing
- **Sentence Transformers** - State-of-the-art embeddings
- **LangGraph** - Workflow orchestration
- **LangChain** - Memory and context management
- **LlamaIndex** - Document loaders and indexing
- **Graphiti** - Temporal knowledge graphs
- **Supabase** - Backend-as-a-service
- **Neo4j** - Graph database
- **Chroma** - Vector database

---

**Note:** This documentation is generated for version 1.0.0. For the latest updates, see the [CHANGELOG](../CHANGELOG.md).
