# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
[d/AI_Workspace]/
├── 01_Case_Intelligence/          # Case intelligence project
├── 02_Evidence_Vault/             # Evidence vault project
├── 03_Satellite_Tools/           # Standalone tools and utilities
│   ├── EnvManager/                # Windows environment variable manager (Go)
│   ├── External_Components/        # External tools and components
│   │   └── Tools/
│   │       └── MCP_Local/        # MCP server implementations
│   ├── Genkit/                   # Genkit-related files
│   ├── Root_Scripts/             # Root-level scripts
│   └── Secrets/                  # Secret management files
├── 03_TraceIQ_Lab/              # TraceIQ analysis tools
├── 04_AI_Assets/               # AI-related assets and resources
│   ├── Agents/                  # AI agent definitions (empty)
│   ├── Chat_Exports/            # Exported chat data
│   │   └── Extracted_Narratives/
│   └── Skills/                  # AI skill packages
│       └── remembering-conversations/
│           └── tool/           # Conversation memory tool (TypeScript)
├── 04_Component_Library/         # Component library
├── 05_Workbench/               # Workbench area
├── 06_Gemini_Debris/          # Gemini-related tools and debris
│   └── Chunk_Parse/            # Conversation parsing tools
│       ├── Chunker/             # Python chunking utilities
│       ├── context-relay/        # Context relay components
│       ├── ConversationExtractorModule-main/
│       ├── lexicon_-conversational-analysis-engine (1)/
│       ├── MCP_Local/           # MCP servers for Gemini
│       └── xml-stream-processor/
├── Universal_Agents/           # Cross-platform AI agents
│   ├── agents/                 # Agent definitions
│   │   ├── agent_creator/      # Agent creation agent
│   │   ├── doc_alchemist/      # Document conversion agent
│   │   ├── file_investigator/  # File analysis agent
│   │   ├── json_surgeon/      # JSON manipulation agent
│   │   ├── mcp_architect/     # MCP server architect
│   │   └── text_miner/        # Text mining agent
│   ├── scripts/                # Python utility scripts
│   │   ├── entity_extractor.py
│   │   ├── file_analyzer.py
│   │   └── forensic_diff.py
│   ├── plugin.json            # Plugin configuration
│   ├── README.md              # Agent documentation
│   └── forensic-data-refinery (1)/  # Forensic data tool
├── awesome-skills/            # Awesome Skills packages
│   └── ai-ml/               # AI/ML skill collection
│       ├── llm-research-scientist.md
│       ├── prompt-engineer.md
│       ├── ai-application-engineer.md
│       └── ... (12 total skills)
├── Project_Dirs/             # Project directories
│   └── MCP_Tool_Platform/      # MCP tool platform (moved to C:\Users\matts\Projects\TheBigOne\MCP_Tool_Platform\)
├── scripts/                  # Workspace-level scripts
│   ├── check-dev-services.ps1
│   ├── sync-configs-v2.sh
│   ├── mount-r2.cmd
│   └── ... (various utility scripts)
├── .claude/                 # Claude Code configuration
│   ├── memories/             # Claude memory storage
│   └── settings.local.json   # Local settings
├── .opencode/               # OpenCode framework
│   ├── agents/              # OpenCode agent definitions
│   │   └── gsd-*.md       # GSD agents (14 total)
│   ├── commands/             # OpenCode slash commands
│   │   └── gsd/           # GSD commands (28 total)
│   └── get-shit-done/       # GSD workflow system
│       ├── references/        # Reference documents
│       ├── templates/         # Document templates
│       │   └── codebase/    # Codebase mapping templates
│       └── workflows/        # Multi-step workflows
├── .planning/               # Project planning directory
│   └── codebase/            # Codebase analysis documents
├── .venv/                   # Python virtual environment
├── .vscode/                 # VS Code configuration
├── .mcp.json                # MCP server configuration
├── CLAUDE.md                # Claude Code instructions
└── README.md                # Workspace documentation
```

## Directory Purposes

**01_Case_Intelligence/:**
- Purpose: Case intelligence project for legal/investigative work
- Contains: Project-specific files, documentation, sub-projects
- Key files: `AGENTS.md`, `.env.production`
- Subdirectories: AI_Work_Product, Context_History, Doc_Review, Platform_Documentation_Legacy, Strategy_Core

**02_Evidence_Vault/:**
- Purpose: Evidence storage and management system
- Contains: Evidence-related project files
- Key files: None identified

**03_Satellite_Tools/:**
- Purpose: Standalone utility tools and external components
- Contains: Go applications, PowerShell scripts, MCP servers
- Key files: `EnvManager/main.go` (environment manager)
- Subdirectories: EnvManager, External_Components, Genkit, Root_Scripts, Secrets

**03_TraceIQ_Lab/:**
- Purpose: TraceIQ timeline and analysis tools
- Contains: Timeline tools, analysis applications, junkyard archives
- Key files: Various timeline and analysis tools
- Subdirectories: Junkyard, Source directories

**04_AI_Assets/:**
- Purpose: AI-related resources, skills, and agents
- Contains: Skill definitions, conversation tools, chat exports
- Key files: `Skills/remembering-conversations/tool/src/db.ts`, `Skills/remembering-conversations/SKILL.md`
- Subdirectories: Agents (empty), Chat_Exports, Skills

**06_Gemini_Debris/:**
- Purpose: Gemini-related tools and experimental/deprecated code
- Contains: Conversation parsers, MCP servers, analysis engines
- Key files: Various markdown design documents, session exports
- Subdirectories: Chunk_Parse, MCP_Local, story-voice

**Universal_Agents/:**
- Purpose: Cross-platform AI agent definitions and utilities
- Contains: Agent configurations, Python scripts, plugin metadata
- Key files: `agents/file_investigator/agent.md`, `scripts/file_analyzer.py`, `README.md`
- Subdirectories: agents, scripts, forensic-data-refinery (1), notebooklm_manager

**awesome-skills/:**
- Purpose: Third-party skill packages for AI assistants
- Contains: Skill definition files organized by category
- Key files: `ai-ml/README.md`, `ai-ml/llm-research-scientist.md`
- Subdirectories: ai-ml (and potentially other categories)

**Project_Dirs/:**
- Purpose: External project repositories
- Contains: Cloned or linked project directories
- Key files: `MCP_Tool_Platform/`
- Subdirectories: MCP_Tool_Platform and others

**scripts/:**
- Purpose: Workspace-level utility scripts
- Contains: PowerShell and Bash scripts for system tasks
- Key files: `sync-configs-v2.sh`, `check-dev-services.ps1`, `mount-r2.cmd`
- Subdirectories: None (flat structure)

**.claude/:**
- Purpose: Claude Code configuration and memory
- Contains: Settings and memory storage
- Key files: `settings.local.json`, `memories/`
- Subdirectories: memories

**.opencode/:**
- Purpose: OpenCode framework installation
- Contains: GSD workflow system, agents, commands
- Key files: `package.json`, `INSTALLED_FILES.json`, `VERSION`
- Subdirectories: agents, commands, get-shit-done

**.planning/:**
- Purpose: Project planning and codebase analysis
- Contains: Planning documents, codebase mapping results
- Key files: codebase/ARCHITECTURE.md, codebase/STRUCTURE.md (being written)
- Subdirectories: codebase, research-project, templates

## Key File Locations

**Entry Points:**
- `/d/AI_Workspace/Universal_Agents/agents/*/agent.md`: Agent entry points
- `/d/AI_Workspace/.opencode/commands/gsd/*.md`: GSD command definitions
- `/d/AI_Workspace/scripts/*.ps1`: PowerShell utility scripts
- `/d/AI_Workspace/scripts/*.sh`: Bash utility scripts

**Configuration:**
- `/d/AI_Workspace/.mcp.json`: MCP server configuration
- `/d/AI_Workspace/.claude/settings.local.json`: Claude Code local settings
- `/d/AI_Workspace/.opencode/package.json`: OpenCode package manifest
- `/d/AI_Workspace/01_Case_Intelligence/.env.production`: Environment variables

**Core Logic:**
- `/d/AI_Workspace/Universal_Agents/scripts/`: Python utility scripts for agents
- `/d/AI_Workspace/04_AI_Assets/Skills/remembering-conversations/tool/src/`: TypeScript conversation memory tool
- `/d/AI_Workspace/03_Satellite_Tools/EnvManager/`: Go environment manager

**Documentation:**
- `/d/AI_Workspace/CLAUDE.md`: Universal Agent Configuration Guide
- `/d/AI_Workspace/README.md`: Environment variable manager documentation
- `/d/AI_Workspace/Universal_Agents/README.md`: Agents repository documentation
- `/d/AI_Workspace/.opencode/get-shit-done/references/`: GSD reference documents

**Templates:**
- `/d/AI_Workspace/.opencode/get-shit-done/templates/`: Document templates
- `/d/AI_Workspace/.opencode/get-shit-done/templates/codebase/`: Codebase mapping templates

## Naming Conventions

**Files:**
- `agent.md`: Agent configuration files
- `claude_prompt.md`: Claude-specific agent prompts
- `kebab-case.md`: Markdown documentation files
- `kebab-case.ts`: TypeScript source files
- `kebab-case.py`: Python source files
- `kebab-case.go`: Go source files
- `kebab-case.ps1`: PowerShell scripts
- `kebab-case.sh`: Bash scripts
- `.env.production`: Environment configuration files
- `UPPERCASE.md`: Important project files (README, CLAUDE, AGENTS)

**Directories:**
- `kebab-case`: Most directories use lowercase with hyphens
- `snake_case`: Python packages and some tool directories
- `PascalCase`: Some component directories
- Plural for collections: `agents/`, `commands/`, `scripts/`, `templates/`, `workflows/`

**Special Patterns:**
- `gsd-{name}.md`: GSD agent definitions
- `{name}.md`: OpenCode slash command definitions
- ` remembering-conversations`: Multi-word directory with hyphens
- `(1)` suffix: Duplicate/backup directories

## Where to Add New Code

**New Agent:**
- Primary code: `/d/AI_Workspace/Universal_Agents/agents/{agent_name}/`
- Configuration: `{agent_name}/agent.md` (frontmatter + role)
- Documentation: `{agent_name}/claude_prompt.md` (Claude-specific)

**New Skill:**
- Implementation: `/d/AI_Workspace/04_AI_Assets/Skills/{skill_name}/`
- Documentation: `SKILL.md` (or similar naming)
- Tooling: `tool/` subdirectory for executable code

**New MCP Server:**
- Implementation: `/d/AI_Workspace/03_Satellite_Tools/External_Components/Tools/MCP_Local/{server_name}/` or `/d/AI_Workspace/06_Gemini_Debris/Chunk_Parse/MCP_Local/{server_name}/`
- Configuration: Update `/d/AI_Workspace/.mcp.json`

**New GSD Command:**
- Definition: `/d/AI_Workspace/.opencode/commands/gsd/{command-name}.md`
- Related agent: `/d/AI_Workspace/.opencode/agents/gsd-{command-name}.md`

**New GSD Workflow:**
- Implementation: `/d/AI_Workspace/.opencode/get-shit-done/workflows/{workflow-name}.md`

**New Utility Script:**
- Implementation: `/d/AI_Workspace/scripts/` (use .ps1 for PowerShell, .sh for Bash)

**New Template:**
- Implementation: `/d/AI_Workspace/.opencode/get-shit-done/templates/{template-name}.md`

## Special Directories

**Universal_Agents/:**
- Purpose: Central repository for cross-platform AI agents
- Generated: No
- Committed: Yes (source of truth for agents)

**.opencode/:**
- Purpose: OpenCode framework installation (managed by install script)
- Generated: No
- Committed: Yes (source of truth)

**.planning/:**
- Purpose: Project planning and codebase analysis output
- Generated: Yes (by GSD tools)
- Committed: Yes (for tracking)

**.venv/:**
- Purpose: Python virtual environment
- Generated: Yes
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Node.js dependencies (in various projects)
- Generated: Yes
- Committed: No

**06_Gemini_Debris/:**
- Purpose: Archive of Gemini-related experimental code
- Generated: No
- Committed: Yes (archival)

**Junkyard/ (in various locations):**
- Purpose: Archive of deprecated code
- Generated: No
- Committed: Yes (archival)

---

*Structure analysis: 2026-02-23*
*Update when directory structure changes*
