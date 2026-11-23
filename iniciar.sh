#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node &> /dev/null; then
    echo "Node.js nao encontrado. Instale o Node.js 18+ ou use a versao Windows com runtime portatil."
    exit 1
fi

if [ ! -d "server/node_modules" ]; then
    echo "Instalando dependencias do servidor..."
    (cd server && npm install)
fi

if [ ! -f "server/dist/index.js" ]; then
    echo "Compilando servidor..."
    (cd server && npm run build)
fi

node server/dist/index.js
