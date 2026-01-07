# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 1 wiring for web search, browser interactions, NotebookLM tools, mem0 tools, and n8n trigger/status.
- Missing tool registrations for browser extract/click/fill and additional NotebookLM operations.
- Merged gap execution report for Phase 1 progress tracking.

### Changed
- NotebookLM registry schemas aligned with MCP notebooklm-mcp inputs.
- mem0 registry schemas expanded to include user/agent/project metadata and limits.

### Notes
- Playwright/NotebookLM/mem0/n8n integrations still require external services and configuration.

