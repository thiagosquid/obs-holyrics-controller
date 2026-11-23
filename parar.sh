#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="data/server.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Arquivo de PID nao encontrado. O servidor pode nao estar em execucao."
    exit 1
fi

PID=$(cat "$PID_FILE")
if [ -z "$PID" ]; then
    echo "Arquivo de PID vazio."
    exit 1
fi

echo "Encerrando processo $PID..."
if kill "$PID" 2>/dev/null; then
    echo "Servidor encerrado."
else
    echo "Falha ao encerrar o processo. Pode ja estar parado."
fi

rm -f "$PID_FILE"
