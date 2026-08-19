#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/wppbot}"
IMAGE="${IMAGE:-wppbot}"
REMOTE_BASE="${REVENDEDORES_SYNC_REMOTE_BASE:-onedrive:softs/wpp-bot}"
BACKUP_DIR="$APP_DIR/data/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$APP_DIR/data" "$BACKUP_DIR"

sync_um() {
    local tipo="$1"
    local local_file="$2"
    local remote_file="$3"
    local fallback_remote_file="${4:-}"
    local header="$5"
    local remote_tmp="$APP_DIR/data/$tipo-onedrive.csv"
    local state_file="$APP_DIR/data/$tipo-sync-state.json"

    if [ -f "$local_file" ]; then
        cp "$local_file" "$BACKUP_DIR/$tipo-local-$STAMP.csv"
    else
        printf '%s\n' "$header" > "$local_file"
    fi

    if rclone copyto "$REMOTE_BASE/$remote_file" "$remote_tmp"; then
        echo "OneDrive baixado: $REMOTE_BASE/$remote_file"
    elif [ -n "$fallback_remote_file" ] && rclone copyto "$REMOTE_BASE/$fallback_remote_file" "$remote_tmp"; then
        echo "OneDrive baixado: $REMOTE_BASE/$fallback_remote_file"
    else
        echo "Aviso: nao consegui baixar $remote_file. Vou usar somente o CSV local."
        cp "$local_file" "$remote_tmp"
    fi

    cp "$remote_tmp" "$BACKUP_DIR/$tipo-onedrive-$STAMP.csv"

    docker run --rm \
        --env-file "$APP_DIR/.env" \
        -v "$APP_DIR/data:/app/data" \
        "$IMAGE" \
        npm run merge:revendedores -- \
        "$tipo" \
        "/app/data/$(basename "$local_file")" \
        "/app/data/$(basename "$remote_tmp")" \
        "/app/data/$(basename "$local_file")" \
        "/app/data/$(basename "$state_file")"

    rclone copyto "$local_file" "$REMOTE_BASE/$remote_file"
    echo "CSV sincronizado enviado para: $REMOTE_BASE/$remote_file"
}

LEGADO_CLIENTES="$APP_DIR/data/revendedores_clientes.csv"
CLIENTES_LOCAL="$APP_DIR/data/revendedores-clientes.csv"
if [ -f "$LEGADO_CLIENTES" ] && [ ! -f "$CLIENTES_LOCAL" ]; then
    cp "$LEGADO_CLIENTES" "$CLIENTES_LOCAL"
fi

LEGADO_CHAMADOS="$APP_DIR/data/revendedores_chamados.csv"
CHAMADOS_LOCAL="$APP_DIR/data/revendedores-chamados.csv"
if [ -f "$LEGADO_CHAMADOS" ] && [ ! -f "$CHAMADOS_LOCAL" ]; then
    cp "$LEGADO_CHAMADOS" "$CHAMADOS_LOCAL"
fi

sync_um \
    "revendedores" \
    "$APP_DIR/data/revendedores.csv" \
    "revendedores.csv" \
    "" \
    "telefone;nome;status;observacao;creditos;data_fechamento;aviso_fechamento"

sync_um \
    "clientes" \
    "$CLIENTES_LOCAL" \
    "revendedores_clientes.csv" \
    "revendedores-clientes.csv" \
    "revendedor_telefone;revendedor_nome;cliente_nome;cliente_telefone;usuario;senha;dns;m3u;vencimento;status;observacao;aviso_vencimento"

sync_um \
    "chamados" \
    "$CHAMADOS_LOCAL" \
    "revendedores_chamados.csv" \
    "revendedores-chamados.csv" \
    "codigo;revendedor_telefone;revendedor_nome;cliente_nome;usuario;descricao;status;criado_em;atualizado_em;observacao"

echo "Revendedores sincronizados com o OneDrive."
