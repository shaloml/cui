# CUI Server Dockerfile
# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and scripts (needed for postinstall)
COPY package*.json ./
COPY scripts ./scripts

# Install dependencies (allow scripts to build native modules)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:22-slim AS production

WORKDIR /app

# Install git (required for Claude Code operations)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Copy node_modules from builder (includes compiled native modules)
COPY --from=builder /app/node_modules ./node_modules

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Remove node_modules claude symlink to use mounted host Claude instead
RUN rm -f /app/node_modules/.bin/claude

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Set executable permissions on MCP server
RUN chmod +x dist/mcp-server/index.js

# Create directories for Claude config and CUI config
RUN mkdir -p /root/.claude /root/.cui

# Environment variables
ENV NODE_ENV=production
ENV PORT=9090
ENV PATH="/usr/local/bin:$PATH"

# Expose port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9090/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start the server (bind to 0.0.0.0 for Docker on port 9090)
CMD ["node", "dist/server.js", "--host", "0.0.0.0", "--port", "9090"]
