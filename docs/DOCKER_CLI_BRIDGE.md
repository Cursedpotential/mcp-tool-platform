# Docker CLI Bridge Specification

This document defines the API contract and architecture for connecting MCP Tool Shop to a remote Docker container running CLI tools (Claude Code, Gemini CLI, Aider, etc.) on your VPS.

## Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│   MCP Tool Shop     │         │        VPS Docker Container       │
│   (Manus Hosted)    │         │                                   │
│                     │         │  ┌─────────────────────────────┐  │
│  ┌───────────────┐  │         │  │   CLI Bridge HTTP Server    │  │
│  │ Provider Hub  │──┼─────────┼──│   (Express/FastAPI)         │  │
│  │               │  │ HTTPS   │  │                             │  │
│  │ Remote CLI    │  │ via     │  │  ┌─────┐ ┌─────┐ ┌─────┐   │  │
│  │ Provider      │  │ Tailscale│  │  │Claude│ │Gemini│ │Aider│   │  │
│  └───────────────┘  │ or      │  │  │ CLI │ │ CLI │ │     │   │  │
│                     │ Cloudflare│ │  └─────┘ └─────┘ └─────┘   │  │
└─────────────────────┘ Tunnel  │  └─────────────────────────────┘  │
                                └──────────────────────────────────┘
```

## Connection Options

### Option 1: Tailscale (Recommended)

Tailscale creates a private mesh network between your devices. The VPS appears as a private IP on your Tailscale network.

**Pros:**
- Zero configuration NAT traversal
- End-to-end encryption
- No exposed public ports
- Works behind firewalls

**Configuration:**
```
Endpoint: http://your-vps-tailscale-hostname:8787
Auth: Bearer token
```

### Option 2: Cloudflare Tunnel

Cloudflare Tunnel (formerly Argo Tunnel) creates a secure outbound-only connection from your VPS to Cloudflare's edge.

**Pros:**
- No inbound firewall rules needed
- DDoS protection
- Zero-trust access policies
- Custom domain support

**Configuration:**
```
Endpoint: https://cli-bridge.your-domain.com
Auth: Cloudflare Access JWT or Bearer token
```

---

## API Contract

### Base URL
```
{BRIDGE_ENDPOINT}/api/v1
```

### Authentication
All requests require a Bearer token in the Authorization header:
```
Authorization: Bearer {BRIDGE_API_KEY}
```

---

### Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "tools": {
    "claude": { "installed": true, "version": "1.0.0" },
    "gemini": { "installed": true, "version": "2024.1" },
    "aider": { "installed": true, "version": "0.50.0" }
  },
  "uptime": 86400
}
```

---

#### 2. List Available Tools
```http
GET /tools
```

**Response:**
```json
{
  "tools": [
    {
      "id": "claude",
      "name": "Claude Code CLI",
      "description": "Anthropic Claude CLI for code assistance",
      "capabilities": ["chat", "code", "edit"],
      "maxContextTokens": 200000
    },
    {
      "id": "gemini",
      "name": "Gemini CLI",
      "description": "Google Gemini CLI for general assistance",
      "capabilities": ["chat", "code", "multimodal"],
      "maxContextTokens": 2000000
    },
    {
      "id": "aider",
      "name": "Aider",
      "description": "AI pair programming in your terminal",
      "capabilities": ["code", "edit", "git"],
      "maxContextTokens": 128000
    }
  ]
}
```

---

#### 3. Invoke Tool (Non-Streaming)
```http
POST /tools/{tool_id}/invoke
Content-Type: application/json
```

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Explain this code..." }
  ],
  "options": {
    "timeout": 120000,
    "workingDir": "/workspace/project",
    "env": {
      "CUSTOM_VAR": "value"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "content": "This code does...",
  "tool": "claude",
  "latencyMs": 5432,
  "tokensUsed": {
    "input": 150,
    "output": 500
  }
}
```

---

#### 4. Invoke Tool (Streaming)
```http
POST /tools/{tool_id}/stream
Content-Type: application/json
Accept: text/event-stream
```

**Request Body:** Same as non-streaming

**Response:** Server-Sent Events (SSE)
```
event: start
data: {"tool": "claude", "sessionId": "abc123"}

event: chunk
data: {"content": "This "}

event: chunk
data: {"content": "code "}

event: chunk
data: {"content": "does..."}

event: done
data: {"latencyMs": 5432, "tokensUsed": {"input": 150, "output": 500}}
```

---

#### 5. Session Management (Optional)
For tools that support persistent sessions (like Aider with git context):

```http
POST /sessions
Content-Type: application/json
```

**Request Body:**
```json
{
  "tool": "aider",
  "workingDir": "/workspace/my-project",
  "options": {
    "gitEnabled": true,
    "model": "claude-3-opus"
  }
}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "tool": "aider",
  "createdAt": "2026-01-01T12:00:00Z",
  "expiresAt": "2026-01-01T14:00:00Z"
}
```

---

## Docker Container Setup

### Dockerfile
```dockerfile
FROM ubuntu:22.04

# Install base dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI (requires Anthropic subscription)
RUN npm install -g @anthropic-ai/claude-cli

# Install Gemini CLI
RUN pip3 install google-generativeai

# Install Aider
RUN pip3 install aider-chat

# Install bridge server
COPY bridge-server /app
WORKDIR /app
RUN npm install

# Expose bridge port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:8787/health || exit 1

CMD ["node", "server.js"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  cli-bridge:
    build: .
    ports:
      - "8787:8787"
    environment:
      - BRIDGE_API_KEY=${BRIDGE_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./workspace:/workspace
      - ~/.config/claude:/root/.config/claude
      - ~/.config/gemini:/root/.config/gemini
    restart: unless-stopped

  # Optional: Tailscale sidecar
  tailscale:
    image: tailscale/tailscale:latest
    hostname: cli-bridge
    environment:
      - TS_AUTHKEY=${TAILSCALE_AUTHKEY}
      - TS_STATE_DIR=/var/lib/tailscale
    volumes:
      - tailscale-state:/var/lib/tailscale
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    restart: unless-stopped

volumes:
  tailscale-state:
```

---

## MCP Tool Shop Configuration

### Settings UI Fields

| Field | Type | Description |
|-------|------|-------------|
| Bridge Endpoint | URL | Full URL to CLI bridge (e.g., `http://vps.tailnet:8787`) |
| API Key | Secret | Bearer token for authentication |
| Connection Type | Select | Tailscale / Cloudflare Tunnel / Direct |
| Health Check Interval | Number | Seconds between health checks (default: 60) |

### Environment Variables

```env
# Add to MCP Tool Shop .env
CLI_BRIDGE_ENDPOINT=http://your-vps.tailnet:8787
CLI_BRIDGE_API_KEY=
CLI_BRIDGE_TIMEOUT=120000
```

---

## Security Considerations

1. **Never expose the bridge directly to the internet** - Always use Tailscale or Cloudflare Tunnel
2. **Rotate API keys regularly** - The bridge API key should be rotated periodically
3. **Limit workspace access** - Mount only necessary directories into the container
4. **Audit logging** - Log all CLI invocations for security review
5. **Rate limiting** - Implement rate limits to prevent abuse
6. **Input validation** - Sanitize all inputs before passing to CLI tools

---

## Implementation Status

| Component | Status |
|-----------|--------|
| API Contract | ✅ Defined |
| Provider Hub Integration | 🔄 In Progress |
| Settings UI | 🔄 In Progress |
| Docker Container | ❌ Not Started |
| Bridge Server | ❌ Not Started |
