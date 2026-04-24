#!/usr/bin/env bash
# Reinicia painel + API. Porta do Next = PORT em .env (ex.: 3001), API = 8091.
# costuma ser processo antigo (nohup / teste manual) a segurar a porta.
#
# Uso:
#   chmod +x /var/www/construneves/deploy/restart-painel-services.sh
#   /var/www/construneves/deploy/restart-painel-services.sh

set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/construneves/.env}"
PAINEL_PORT="3000"
if [[ -f "${ENV_FILE}" ]]; then
  v="$(grep -E '^[[:space:]]*PORT=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '\r' | tr -d '[:space:]')"
  [[ -n "${v}" ]] && PAINEL_PORT="${v}"
fi

free_port() {
  local port="$1"
  local pids
  # grep sem match devolve 1; com pipefail isso rebentava o script antes de systemctl start.
  pids=$(ss -tlnp 2>/dev/null | { grep ":${port} " || true; } | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
  if [[ -n "${pids}" ]]; then
    echo "Porta ${port} em uso por PID(s): ${pids} — a terminar…"
    # systemd pode ser o dono; preferir parar serviços primeiro
    kill -TERM ${pids} 2>/dev/null || true
    sleep 1
    kill -KILL ${pids} 2>/dev/null || true
  fi
}

echo "Parar units (liberta portas se possível)…"
sudo systemctl stop construneves-painel construneves-painel-api 2>/dev/null || true
sleep 1

free_port "${PAINEL_PORT}"
free_port 8091
sleep 1

echo "Arrancar units (API primeiro)…"
sudo systemctl start construneves-painel-api construneves-painel

sleep 3
if systemctl is-active --quiet construneves-painel-api &&
  systemctl is-active --quiet construneves-painel; then
  echo "OK — ambos active."
  echo "Teste: curl -sS http://127.0.0.1:8091/health && curl -sSI http://127.0.0.1:${PAINEL_PORT}/ | head -1"
else
  echo "ERRO — um ou os dois serviços não ficaram active. Estado:" >&2
  systemctl is-active construneves-painel-api construneves-painel || true
  echo "--- últimas linhas do journal (painel):" >&2
  sudo journalctl -u construneves-painel -n 15 --no-pager >&2
  echo "--- últimas linhas do journal (API):" >&2
  sudo journalctl -u construneves-painel-api -n 15 --no-pager >&2
  exit 1
fi
