#!/usr/bin/env bash
# Reinicia painel + API. Use se aparecer EADDRINUSE nas portas 3010 ou 8091:
# costuma ser processo antigo (nohup / teste manual) a segurar a porta.
#
# Uso:
#   chmod +x /var/www/construneves/deploy/restart-painel-services.sh
#   /var/www/construneves/deploy/restart-painel-services.sh

set -euo pipefail

free_port() {
  local port="$1"
  local pids
  pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
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

free_port 3010
free_port 8091
sleep 1

echo "Arrancar units…"
sudo systemctl start construneves-painel construneves-painel-api

sleep 2
systemctl is-active construneves-painel-api construneves-painel
echo "OK — teste: curl -s http://127.0.0.1:8091/health && curl -sI http://127.0.0.1:3010/ | head -1"
