#!/bin/bash

# CUI Server - Production Start Script
# =====================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting CUI Server in Production Mode${NC}"
echo "==========================================="

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Check node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20+ required (found: $(node -v))"
    exit 1
fi

# Check if dist folder exists, if not build
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}📦 Building project...${NC}"
    npm run build
fi

# Optional: Rebuild if source is newer than dist
if [ -d "src" ] && [ "$(find src -newer dist -type f 2>/dev/null | head -1)" ]; then
    echo -e "${YELLOW}📦 Source changed, rebuilding...${NC}"
    npm run build
fi

# Start the server
echo -e "${GREEN}✅ Starting server...${NC}"
echo ""

NODE_ENV=production node dist/server.js "$@"
