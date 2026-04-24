#!/usr/bin/env bash
# Chama POST /notificacoes/pedido-compra-negativos na API interna (mesmo .env: CONSTRUNEVES_PED_COMPRA_*).
# Uso no servidor:  bash /var/www/construneves/deploy/ped-compra-negativos-test.sh
# URL alternativa:  PAINEL_INTERNAL_API=http://127.0.0.1:8091 bash ...
set -euo pipefail
BASE="${PAINEL_INTERNAL_API:-http://127.0.0.1:8091}"
BASE="${BASE%/}"
URL="${BASE}/notificacoes/pedido-compra-negativos"
fmt_json() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    python3 -m json.tool
  fi
}
curl -sS -X POST "$URL" -H "Content-Type: application/json" -d "{}" | fmt_json
