# MCP Tool Platform - Development Workflow

## Project Overview

**Forensic Legal Case Management System + MCP Tool Server**

## Version Management

- **Current Version:** v0.1.0
- **Next Release:** v0.2.0 (Phase 1 Complete)
- **Release Schedule:** Major feature completion milestones

## Development Process

### 1. Before Each Session

1. Check CHANGELOG.md for recent updates
2. Review current TODO.md priorities
3. Verify git status and create branch for new work

### 2. During Development

1. Commit changes frequently with descriptive messages
2. Test incrementally
3. Update TODO.md when tasks are completed
4. Document any issues in NOTES.md

### 3. End of Session

1. Commit all changes
2. Update CHANGELOG.md with progress
3. Update TODO.md with remaining tasks
4. Push to remote repository

### 4. File Organization

- **CHANGELOG.md** - Version history and changes
- **TODO.md** - Single source of truth for tasks
- **NOTES.md** - Issues, insights, decisions
- **ARCHITECTURE.md** - System design decisions
- **STATUS_REPORT.md** - Current progress (updated weekly)

## Current Focus

**Phase 1: Docker Compose Fixes (CRITICAL)**

- Fix PostgreSQL dialect in drizzle.config.ts
- Add PGVector and PostGIS extensions
- Implement dual MetaMCP deployment
- Configure self-hosted database strategy

## Success Criteria

1. ✅ Clean, organized codebase
2. ✅ Working document processing by morning
3. ✅ Complete tool execution pipeline
4. ✅ Full LLM integration
5. ✅ Bidirectional MCP architecture
