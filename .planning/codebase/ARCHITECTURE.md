# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Multi-Project Workspace with Distributed Autonomous Agents

**Key Characteristics:**
- Workspace-based organization containing independent projects
- Agent-centric architecture with reusable AI agents
- Modular skills and tools for specialized tasks
- MCP (Model Context Protocol) server integration
- Cross-platform compatibility (Windows/WSL2)

## Layers

**Workspace Level:**
- Purpose: Root organization for all projects and shared resources
- Location: `/d/AI_Workspace/`
- Contains: Project directories, shared configurations, agent definitions
- Depends on: Nothing (root level)
- Used by: All contained projects

**Agents Layer:**
- Purpose: Reusable AI agent definitions that work across platforms
- Location: `/d/AI_Workspace/Universal_Agents/agents/`
- Contains: Agent configurations (`agent.md`, `claude_prompt.md`)
- Depends on: Python scripts in `scripts/`
- Used by: Gemini CLI, Claude Code, Qwen CLI

**Skills Layer:**
- Purpose: Specialized skill packages for AI assistants
- Location: `/d/AI_Workspace/awesome-skills/` and `/d/AI_Workspace/04_AI_Assets/Skills/`
- Contains: Skill definition files (`.md`, `.skill`, `.zip`)
- Depends on: Nothing (self-contained)
- Used by: AI platforms that support skill loading

**Tools Layer:**
- Purpose: Standalone tools and utilities
- Location: `/d/AI_Workspace/scripts/`, `/d/AI_Workspace/03_Satellite_Tools/`
- Contains: PowerShell scripts, Bash scripts, Python utilities, Go applications
- Depends on: System utilities, external APIs
- Used by: Users and automation workflows

**MCP Layer:**
- Purpose: Model Context Protocol servers for extending AI capabilities
- Location: `/d/AI_Workspace/06_Gemini_Debris/Chunk_Parse/MCP_Local/`, `/d/AI_Workspace/03_Satellite_Tools/External_Components/Tools/MCP_Local/`
- Contains: MCP server implementations (Python, Node.js)
- Depends on: MCP client frameworks
- Used by: Claude Code, other MCP-compatible AI tools

**GSD Layer:**
- Purpose: Get-Shit-Done workflow automation system
- Location: `/d/AI_Workspace/.opencode/get-shit-done/`
- Contains: Commands, agents, workflows, templates, references
- Depends on: OpenCode CLI framework
- Used by: OpenCode for project management workflows

## Data Flow

**Agent Execution Flow:**

1. User invokes agent via CLI (`/agent_name` or similar)
2. Platform loads agent configuration from `Universal_Agents/agents/{agent_name}/agent.md`
3. Agent executes with available tools (Read, Bash, Grep, etc.)
4. Agent may call Python scripts from `Universal_Agents/scripts/`
5. Results returned to user

**MCP Server Flow:**

1. MCP client (Claude Code, etc.) loads server from config (`.mcp.json`)
2. Server process spawned with command and args
3. Server exposes tools via MCP protocol
4. Client invokes tools as needed during AI interactions
5. Server processes requests and returns results

**GSD Workflow Flow:**

1. User invokes GSD command (`/gsd-new-project`, `/gsd-plan-phase`, etc.)
2. OpenCode loads command definition from `.opencode/commands/gsd/{command}.md`
3. Command may spawn sub-agents for specialized tasks
4. Agents write output directly to `.planning/` directory
5. User receives confirmation and next steps

**State Management:**
- Workspace: File-based (no central database)
- Agents: Stateless (config-driven)
- GSD: File-based state in `.planning/` directory
- MCP: Per-session connections (no persistent state)

## Key Abstractions

**Agent:**
- Purpose: Reusable AI assistant with specific capabilities
- Examples: `/d/AI_Workspace/Universal_Agents/agents/file_investigator/agent.md`, `/d/AI_Workspace/Universal_Agents/agents/doc_alchemist/agent.md`
- Pattern: Markdown frontmatter configuration + role definition

**Skill:**
- Purpose: Domain-specific expertise for AI assistants
- Examples: `/d/AI_Workspace/awesome-skills/ai-ml/llm-research-scientist.md`, `/d/AI_Workspace/04_AI_Assets/Skills/remembering-conversations/SKILL.md`
- Pattern: Self-contained capability definition

**MCP Server:**
- Purpose: Extensible tool interface for AI platforms
- Examples: `/d/AI_Workspace/06_Gemini_Debris/Chunk_Parse/MCP_Local/stirling-pdf-mcp/`, `/d/AI_Workspace/06_Gemini_Debris/Chunk_Parse/MCP_Local/notebooklm-mcp-target/`
- Pattern: Protocol-compliant server with tool definitions

**GSD Agent:**
- Purpose: Specialized agents for project management workflows
- Examples: `/d/AI_Workspace/.opencode/agents/gsd-codebase-mapper.md`, `/d/AI_Workspace/.opencode/agents/gsd-planner.md`
- Pattern: GSD-specific agent with defined responsibilities

**GSD Workflow:**
- Purpose: Multi-step procedure template
- Examples: `/d/AI_Workspace/.opencode/get-shit-done/workflows/map-codebase.md`, `/d/AI_Workspace/.opencode/get-shit-done/workflows/execute-plan.md`
- Pattern: Step-by-step process definition

## Entry Points

**Agent Entry Points:**
- Location: `/d/AI_Workspace/Universal_Agents/agents/{agent_name}/agent.md`
- Triggers: User invokes via CLI or platform UI
- Responsibilities: Define agent capabilities, tools, role

**MCP Server Entry Points:**
- Location: Various, defined in `/d/AI_Workspace/.mcp.json`
- Triggers: AI platform loads MCP config
- Responsibilities: Expose tools via MCP protocol

**GSD Command Entry Points:**
- Location: `/d/AI_Workspace/.opencode/commands/gsd/{command}.md`
- Triggers: User invokes slash command
- Responsibilities: Define command behavior, spawn agents

**Tool Entry Points:**
- Location: `/d/AI_Workspace/scripts/*`, various project scripts
- Triggers: Direct execution or agent invocation
- Responsibilities: Perform specific utility tasks

## Error Handling

**Strategy:** Platform-dependent, but generally exception-based with user-friendly messages

**Patterns:**
- Agents: Return error messages, exit with status codes
- Python scripts: Try/except with logging to stderr
- PowerShell scripts: Try/Catch with Write-Error
- MCP servers: Protocol error responses

## Cross-Cutting Concerns

**Logging:**
- Approach: Varies by tool (console, log files, stderr)
- Python: `logging` module in `/d/AI_Workspace/Universal_Agents/scripts/file_analyzer.py`
- PowerShell: Write-Host/Write-Error in `/d/AI_Workspace/scripts/`

**Validation:**
- Approach: Input validation at tool boundaries
- File paths validated before operations
- Configuration validation on load

**Authentication:**
- Approach: Environment variables and config files
- `.mcp.json` contains API keys
- `.env` files in project directories
- Windows registry for machine-level env vars (EnvManager)

**Configuration:**
- Approach: Distributed configuration files
- `.mcp.json` for MCP servers
- `.opencode/` for OpenCode config
- `.claude/` for Claude Code settings
- Agent-specific config in agent directories

---

*Architecture analysis: 2026-02-23*
