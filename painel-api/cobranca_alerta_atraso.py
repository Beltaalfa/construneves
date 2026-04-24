"""
Alerta diário (WhatsApp / WAHA) — clientes com títulos em atraso > N dias,
sem apontamento de cobrança no mês corrente e sem recebimento (baixa) no mês corrente.

Títulos a receber (TB_CONTA_RECEBER + sufixo opcional _2). Por omissão só clientes com NF MT
finalizada (CONSTRUNEVES_RECEBER_EXIGE_CLIENTE_NF_MT). Apontamentos: TB_CLI_CONT_AGENDADO.
"""
from __future__ import annotations

import logging
import os
from datetime import date
from decimal import Decimal
from typing import Any

from receber_tables import (
    apply_receber_suffix as _receber_sql,
    receber_sql_and_cliente_com_nf_mt as _nf_mt_cli,
)

logger = logging.getLogger(__name__)


def _env(k: str, d: str = "") -> str:
    return (os.getenv(k) or d).strip()


def _pick(r: dict[str, Any], *names: str) -> Any:
    """Firebird / drivers podem devolver chaves em MAIÚSCULAS ou minúsculas."""
    for n in names:
        if n in r:
            v = r[n]
            if v is not None and not (isinstance(v, str) and v.strip() == ""):
                return v
    for n in names:
        lo = n.lower()
        for k, v in r.items():
            if isinstance(k, str) and k.lower() == lo:
                if v is not None and not (isinstance(v, str) and v.strip() == ""):
                    return v
    return None


def _pick_str(r: dict[str, Any], *names: str) -> str:
    v = _pick(r, *names)
    if v is None:
        return ""
    return str(v).strip()


def _cell_num(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _row_num(r: dict[str, Any], *names: str) -> float:
    return _cell_num(_pick(r, *names))


def sql_clientes_atraso_sem_cobranca_nem_recebimento_no_mes(dias_atraso: int) -> str:
    d = max(1, min(int(dias_atraso), 365))
    w_aberto = (
        "(R.CANC IS NULL OR TRIM(R.CANC) = '' OR R.CANC = 'N') AND COALESCE(R.VLR_RESTANTE, 0) > 0"
    )
    # Primeiro dia do mês corrente (Firebird)
    inicio_mes = "DATEADD(DAY, 1 - EXTRACT(DAY FROM CURRENT_DATE), CURRENT_DATE)"
    raw = f"""
    SELECT
      C.ID_CLIENTE,
      TRIM(COALESCE(C.NOME, '')) AS CLIENTE,
      MIN(R.DT_VENCTO) AS VENCTO_MAIS_ANTIGO,
      MAX(CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) AS DIAS_ATRASO_MAX,
      COALESCE(SUM(R.VLR_RESTANTE), 0) AS SALDO_ABERTO_ATRASO
    FROM TB_CONTA_RECEBER R
    INNER JOIN TB_CLIENTE C ON C.ID_CLIENTE = R.ID_CLIENTE
    WHERE {w_aberto}{_nf_mt_cli("C.ID_CLIENTE")}
      AND R.DT_VENCTO < DATEADD(DAY, -{d}, CURRENT_DATE)
      AND NOT EXISTS (
        SELECT 1 FROM TB_CLI_CONT_AGENDADO A
        WHERE A.ID_CLIENTE = C.ID_CLIENTE
          AND COALESCE(A.DT_CONTATO, A.DT_AGENDA) IS NOT NULL
          AND CAST(COALESCE(A.DT_CONTATO, A.DT_AGENDA) AS DATE) >= {inicio_mes}
          AND CAST(COALESCE(A.DT_CONTATO, A.DT_AGENDA) AS DATE) <= CURRENT_DATE
      )
      AND NOT EXISTS (
        SELECT 1 FROM TB_CTAREC_BAIXA B
        INNER JOIN TB_CONTA_RECEBER RX ON RX.ID_CTAREC = B.ID_CTAREC
        WHERE RX.ID_CLIENTE = C.ID_CLIENTE
          AND CAST(B.DT_BAIXA AS DATE) >= {inicio_mes}
          AND CAST(B.DT_BAIXA AS DATE) <= CURRENT_DATE
      )
    GROUP BY C.ID_CLIENTE, C.NOME
    HAVING COALESCE(SUM(R.VLR_RESTANTE), 0) > 0
    ORDER BY C.NOME
    """
    return _receber_sql(raw)


def _fmt_money(v: float) -> str:
    s = f"{v:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _phones_cobranca() -> list[str]:
    try:
        from notificacoes import list_phones_for_cobranca_alerta

        out = list_phones_for_cobranca_alerta()
        if out:
            return out
    except Exception as e:
        logger.warning("cobranca: lista do painel indisponível, usa .env: %s", e)
    import re

    raw = _env("WHATSAPP_COBRANCA_ATRASO_PARA", "5534988070651")
    if not raw.strip():
        raw = "5534988070651"
    p = re.sub(r"\D", "", raw)
    return [p] if len(p) >= 10 else []


def _build_messages(rows: list[dict[str, Any]], dias: int) -> list[str]:
    hoje = date.today().strftime("%d/%m/%Y")
    intro = (
        f"Cobrança — Construneves ({hoje})\n\n"
        f"Clientes (com venda MT / NF finalizada) com título em aberto há mais de {dias} dias, "
        f"sem apontamento no mês e sem baixa no mês:\n\n"
    )
    blocks: list[str] = []
    cur = intro
    max_chunk = 3600
    for r in rows:
        cid = _pick(r, "ID_CLIENTE", "id_cliente")
        nome = _pick_str(r, "CLIENTE", "cliente") or "(sem nome)"
        ven = _pick(r, "VENCTO_MAIS_ANTIGO", "vencto_mais_antigo")
        ven_s = ven.isoformat() if hasattr(ven, "isoformat") else str(ven or "—")
        dias_m = int(_row_num(r, "DIAS_ATRASO_MAX", "dias_atraso_max"))
        saldo = _fmt_money(
            _row_num(r, "SALDO_ABERTO_ATRASO", "saldo_aberto_atraso"),
        )
        line = f"• ID {cid} — {nome}\n  Venc. mais antigo: {ven_s} · até {dias_m} dias atraso · saldo (faixa): R$ {saldo}\n"
        if len(cur) + len(line) > max_chunk:
            blocks.append(cur.rstrip())
            cur = f"(continuação {hoje})\n\n" + line
        else:
            cur += line
    if cur.strip():
        blocks.append(cur.rstrip())
    if not blocks:
        blocks.append(
            intro
            + "Nenhum cliente nestas condições no momento.\n"
            + "(Quando a lista estiver vazia, não há ação necessária.)"
        )
    return blocks


def run_cobranca_alerta_atraso_diario(_execute: Any, *, dry_run: bool | None = None) -> dict[str, Any]:
    """
    Executa a consulta e envia WhatsApp ao número do setor (WHATSAPP_COBRANCA_ATRASO_PARA).
    Se dry_run=True, não envia (útil para /teste). Se None, respeita COBRANCA_ALERTA_ATRASO_DRY_RUN no .env.
    """
    if _env("COBRANCA_ALERTA_ATRASO_DESLIGADO", "").lower() in ("1", "true", "yes", "sim"):
        return {"ok": True, "skipped": True, "reason": "COBRANCA_ALERTA_ATRASO_DESLIGADO"}

    try:
        dias = int(_env("COBRANCA_ATRASO_DIAS", "60") or "60")
    except ValueError:
        dias = 60
    dias = max(1, min(dias, 365))

    sql = sql_clientes_atraso_sem_cobranca_nem_recebimento_no_mes(dias)
    try:
        _, rows = _execute(sql, max_rows=None)
    except Exception as e:
        logger.exception("cobranca_alerta_atraso: consulta: %s", e)
        return {"ok": False, "erro": str(e)}

    if not isinstance(rows, list):
        rows = []

    phones = _phones_cobranca()
    if not phones:
        return {"ok": False, "erro": "WHATSAPP_COBRANCA_ATRASO_PARA inválido ou vazio"}

    messages = _build_messages(rows, dias)

    force_dry = dry_run is True or _env("COBRANCA_ALERTA_ATRASO_DRY_RUN", "").lower() in (
        "1",
        "true",
        "yes",
        "sim",
    )
    if force_dry:
        return {
            "ok": True,
            "dry_run": True,
            "dias_atraso": dias,
            "qtd_clientes": len(rows),
            "destinos": phones,
            "partes": len(messages),
            "texto_primeira_parte": messages[0] if messages else "",
        }

    from estoque_alerta import send_waha_text_to_phone_list

    last_det = ""
    for i, part in enumerate(messages):
        ok, det = send_waha_text_to_phone_list(phones, part)
        last_det = det
        if not ok:
            return {
                "ok": False,
                "erro": det,
                "qtd_clientes": len(rows),
                "parte_enviada": i,
                "partes_total": len(messages),
            }
    return {
        "ok": True,
        "whats": True,
        "dias_atraso": dias,
        "qtd_clientes": len(rows),
        "partes": len(messages),
        "resposta": last_det[:500],
        "destinos": phones,
    }
