#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/wppbot}"
IMAGE="${IMAGE:-wppbot}"
CONTAINER="${CONTAINER:-wppbot}"
BACKUP_DIR="$APP_DIR/data/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$APP_DIR/data" "$BACKUP_DIR"

for arquivo in clientes testes leads marketing servicos; do
    if [ -f "$APP_DIR/data/$arquivo.csv" ]; then
        cp "$APP_DIR/data/$arquivo.csv" "$BACKUP_DIR/$arquivo-google-local-$STAMP.csv"
    fi
done

docker run --rm \
    --env-file "$APP_DIR/.env" \
    -v "$APP_DIR/data:/app/data" \
    "$IMAGE" \
    npm run sync:google

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker exec "$CONTAINER" npm run importar:clientes || true
fi

echo "Google Sheets sincronizado com os CSVs locais."
