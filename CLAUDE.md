# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CUI (Common Agent UI) is a web-based interface for AI agents built on Claude Code SDK. It's a full-stack TypeScript application that enables users to start, manage, and interact with agentic conversations from any browser.

## Common Commands

```bash
# Development
npm run dev              # Backend with tsx watch
npm run dev:web          # Frontend with Vite

# Build
npm run build            # Full production build (web + server + mcp)

# Testing
npm test                 # Run all tests
npm run unit-tests       # Unit tests only
npm run integration-tests # Integration tests only
npm test -- tests/unit/claude-process-manager.test.ts  # Run specific test file
npm test -- --testNamePattern="should start"           # Run tests matching pattern
npm run test:coverage    # Run with coverage

# Code Quality
npm run lint             # ESLint
npm run typecheck        # TypeScript check
```

## Architecture

### Backend Structure

The server is built with Express and follows a service-oriented architecture:

- **Entry Point**: `src/server.ts` → CLI entry, `src/cui-server.ts` → Main server class
- **Services** (`src/services/`): Core business logic
  - `claude-process-manager.ts` - Manages Claude CLI process lifecycle and streaming
  - `claude-history-reader.ts` - Reads Claude Code conversation history from `~/.claude/`
  - `stream-manager.ts` - Real-time message streaming via EventSource
  - `session-info-service.ts` - Session metadata using SQLite
  - `permission-tracker.ts` - Tool permission management
  - `config-service.ts` - Server configuration from `~/.cui/config.json`
- **Routes** (`src/routes/`): REST API endpoints
- **Middleware** (`src/middleware/`): Auth, CORS, error handling, request logging
- **MCP Server** (`src/mcp-server/`): Standalone Model Context Protocol server for permission requests

### Frontend Structure

React 18 application in `src/web/`:

- `chat/` - Main chat interface with components, contexts, hooks
- `components/` - Shared UI components (Login, etc.)
- `inspector/` - Debug/inspection tools
- Built with Vite, Tailwind CSS v4, Radix UI

### Key Data Flow

1. User sends message via React frontend
2. `conversation.routes.ts` receives request
3. `ClaudeProcessManager` spawns Claude CLI process
4. `StreamManager` forwards JSONL events via EventSource to frontend
5. `PermissionTracker` handles tool permission requests via MCP server

### Type System

Core types in `src/types/index.ts`:
- `StreamMessage` - System, Assistant, User, Result message types
- `ConversationSummary`, `ConversationMessage` - Conversation data
- `CUIError` - Centralized error handling

## Testing

### Philosophy

- Prefer real implementations over mocks when possible
- Target 90%+ unit test coverage
- Use mock Claude CLI (`tests/__mocks__/claude`) for consistent testing
- Silent logging in tests (`LOG_LEVEL=silent`)

### Mock Claude CLI

The mock at `tests/__mocks__/claude` simulates real Claude CLI behavior with valid JSONL output. Use it in tests:

```typescript
function getMockClaudeExecutablePath(): string {
  return path.join(process.cwd(), 'tests', '__mocks__', 'claude');
}

const serverPort = 9000 + Math.floor(Math.random() * 1000);
const server = new CUIServer({ port: serverPort });
(server as any).processManager = new ClaudeProcessManager(mockClaudePath);
```

### Test Structure

```
tests/
├── __mocks__/claude     # Mock Claude CLI executable
├── integration/         # Integration tests
├── unit/               # Unit tests (services, CLI commands)
└── setup.ts            # Vitest setup
```

## Configuration

- User config stored in `~/.cui/config.json`
- Session data in `~/.cui/session-info.db` (SQLite)
- Path aliases: `@/` maps to `src/` in both source and tests

## Key Dependencies

- `@anthropic-ai/claude-code` - Claude Code SDK
- `express` - HTTP server
- `better-sqlite3` - Session storage
- `pino` - Logging
- React, Vite, Tailwind - Frontend

## Remote/VM Development

This project runs on a VM. When starting dev servers:

1. **Always bind to 0.0.0.0**: Use `--host 0.0.0.0` flag
2. **Display actual IP**: Run `hostname -I | awk '{print $1}'` to get the server IP
3. **Example commands**:
   - `npm run dev:web` (already configured for 0.0.0.0)
   - `vite --host 0.0.0.0`
   - `python -m http.server 8000 --bind 0.0.0.0`

When showing URLs to the user, replace `localhost` with the actual IP address.
