#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/wppbot}"
IMAGE="${IMAGE:-wppbot}"
CONTAINER="${CONTAINER:-wppbot}"
REMOTE="${CLIENTES_SYNC_REMOTE:-onedrive:softs/wpp-bot/clientes.csv}"
LOCAL="$APP_DIR/data/clientes.csv"
REMOTE_TMP="$APP_DIR/data/clientes-onedrive.csv"
STATE="$APP_DIR/data/clientes-sync-state.json"
BACKUP_DIR="$APP_DIR/data/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$APP_DIR/data" "$BACKUP_DIR"

if [ -f "$LOCAL" ]; then
    cp "$LOCAL" "$BACKUP_DIR/clientes-local-$STAMP.csv"
fi

if rclone copyto "$REMOTE" "$REMOTE_TMP"; then
    echo "OneDrive baixado: $REMOTE"
else
    echo "Aviso: nao consegui baixar $REMOTE. Vou usar somente o CSV local."
    if [ -f "$LOCAL" ]; then
        cp "$LOCAL" "$REMOTE_TMP"
    else
        printf 'nome;telefone;usuario;senha;dns;m3u;vencimento\n' > "$REMOTE_TMP"
    fi
fi

docker run --rm \
    --env-file "$APP_DIR/.env" \
    -v "$APP_DIR/data:/app/data" \
    "$IMAGE" \
    npm run merge:clientes -- \
    /app/data/clientes.csv \
    /app/data/clientes-onedrive.csv \
    /app/data/clientes.csv \
    /app/data/clientes-sync-state.json

rclone copyto "$LOCAL" "$REMOTE"
echo "CSV mesclado enviado para: $REMOTE"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker exec "$CONTAINER" npm run importar:clientes || true
fi
