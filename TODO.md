<!-- File: TODO.md | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1 -->
# TODO - Current Focus

## Infrastructure & Networking
- Map subdomains to services (public vs tailnet); make Coolify UI (`nexus`) reachable behind Access.
- Apply Traefik labels for Nexus (postgres/cms/photos/n8n) and Forge (llm/mcp/chroma/ui/ollama); keep Kasm/Browser tailnet-only.
- Verify Dragonfly cache + LiteLLM wiring; expose redis TCP only if needed.
- Audit Postgres extensions on Nexus; install missing Supabase-style set (vector, postgis*, pg_graphql, pg_net, pg_cron, pgsodium, wrappers, pgroonga/rum/bloom/pg_trgm, pg_stat_statements, etc.).
- Add centralized logging stack (TBD) for services and workflows.

## Data & Graph
- Wire Neo4j/Graphiti fully (Aura fallback); expose graph tools in MetaMCP; connect entity extraction/workflows to graph schemas.

## Compute & Tools
- Finalize Kasm CLI tool MCP adapters (Claude/Gemini/Quen/OpenCode); keep workspace sync (rclone) to Nexus block storage/R2.
- Headless Colab Enterprise runner: real API calls for run/test/status; store config securely.

## Backend UI & APIs
- Settings router: persist DB/graph/Colab configs; implement API key CRUD with encryption; health/extension checks.
- Pattern router: implement CRUD/categories/stats/import/export/test; hook UI queries/mutations.
- Router core: implement LLM/tool/vector routing, cost/health tracking.

## Frontend
- Settings page: wire Colab test/save actions to backend; surface graph/DB health and extensions.
- Pattern Library: connect to pattern router; add loading/empty states.

## Workflows
- Ensure workflows use graph/entity/extension-aware paths; add logging hooks once stack chosen.

## Testing
- Add targeted tests for settings (graph/Colab/ext checks) and pattern router once implemented.
