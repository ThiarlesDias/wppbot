#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/wppbot}"
IMAGE="${IMAGE:-wppbot}"
CONTAINER="${CONTAINER:-wppbot}"
REMOTE="${CLIENTES_SYNC_REMOTE:-onedrive:softs/wpp-bot/clientes.csv}"
TESTES_REMOTE="${TESTES_SYNC_REMOTE:-onedrive:softs/wpp-bot/testes.csv}"
LEADS_REMOTE="${LEADS_SYNC_REMOTE:-onedrive:softs/wpp-bot/leads.csv}"
LOCAL="$APP_DIR/data/clientes.csv"
TESTES_LOCAL="$APP_DIR/data/testes.csv"
LEADS_LOCAL="$APP_DIR/data/leads.csv"
REMOTE_TMP="$APP_DIR/data/clientes-onedrive.csv"
TESTES_REMOTE_TMP="$APP_DIR/data/testes-onedrive.csv"
LEADS_REMOTE_TMP="$APP_DIR/data/leads-onedrive.csv"
STATE="$APP_DIR/data/clientes-sync-state.json"
TESTES_STATE="$APP_DIR/data/testes-sync-state.json"
LEADS_STATE="$APP_DIR/data/leads-sync-state.json"
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
        printf 'nome;telefone;usuario;senha;dns;m3u;vencimento;valor;telas;meses\n' > "$REMOTE_TMP"
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

if [ -f "$TESTES_LOCAL" ]; then
    cp "$TESTES_LOCAL" "$BACKUP_DIR/testes-local-$STAMP.csv"
fi

if rclone copyto "$TESTES_REMOTE" "$TESTES_REMOTE_TMP"; then
    echo "OneDrive baixado: $TESTES_REMOTE"
else
    echo "Aviso: nao consegui baixar $TESTES_REMOTE. Vou usar somente o CSV local."
    if [ -f "$TESTES_LOCAL" ]; then
        cp "$TESTES_LOCAL" "$TESTES_REMOTE_TMP"
    else
        printf 'telefone;usuario;senha;dns;m3u;criado_em;vencimento;vencimento_iso;horas;status;avisado_em;ultimo_aviso_contratacao;saiu_em\n' > "$TESTES_REMOTE_TMP"
    fi
fi

docker run --rm \
    --env-file "$APP_DIR/.env" \
    -v "$APP_DIR/data:/app/data" \
    "$IMAGE" \
    npm run merge:testes -- \
    /app/data/testes.csv \
    /app/data/testes-onedrive.csv \
    /app/data/testes.csv \
    /app/data/testes-sync-state.json

rclone copyto "$TESTES_LOCAL" "$TESTES_REMOTE"
echo "CSV de testes mesclado enviado para: $TESTES_REMOTE"

if [ -f "$LEADS_LOCAL" ]; then
    cp "$LEADS_LOCAL" "$BACKUP_DIR/leads-local-$STAMP.csv"
fi

if rclone copyto "$LEADS_REMOTE" "$LEADS_REMOTE_TMP"; then
    echo "OneDrive baixado: $LEADS_REMOTE"
else
    echo "Aviso: nao consegui baixar $LEADS_REMOTE. Vou usar somente o CSV local."
    if [ -f "$LEADS_LOCAL" ]; then
        cp "$LEADS_LOCAL" "$LEADS_REMOTE_TMP"
    else
        printf 'telefone;numero;nome;fluxo;status;criado_em;ultima_interacao;tentativas_retomada;ultimo_remarketing;observacao\n' > "$LEADS_REMOTE_TMP"
    fi
fi

docker run --rm \
    --env-file "$APP_DIR/.env" \
    -v "$APP_DIR/data:/app/data" \
    "$IMAGE" \
    npm run merge:leads -- \
    /app/data/leads.csv \
    /app/data/leads-onedrive.csv \
    /app/data/leads.csv \
    /app/data/leads-sync-state.json

rclone copyto "$LEADS_LOCAL" "$LEADS_REMOTE"
echo "CSV de leads mesclado enviado para: $LEADS_REMOTE"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker exec "$CONTAINER" npm run importar:clientes || true
fi
