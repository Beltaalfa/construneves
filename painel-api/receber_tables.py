"""
Contas a receber: TB_CONTA_RECEBER / TB_CTAREC_BAIXA / TB_CLIENTE (+ sufixo opcional _2).

- ``CONSTRUNEVES_RECEBER_TABELA_SUFFIX=_2`` — bases com tabelas duplicadas MT.
- ``CONSTRUNEVES_RECEBER_EXIGE_CLIENTE_NF_MT`` — por omissão **ligado** (omitir ou 1):
  só clientes com pelo menos uma NF finalizada em ``TB_NFVENDA_2`` (exclui dívidas só CLIPP
  de quem nunca comprou no MT). Desligar: ``0`` ou ``false``.
"""
from __future__ import annotations

import os
import re

_BASES = ("TB_CONTA_RECEBER", "TB_CTAREC_BAIXA", "TB_CLIENTE")


def receber_table_suffix() -> str:
    raw = os.getenv("CONSTRUNEVES_RECEBER_TABELA_SUFFIX")
    if raw is None:
        return ""
    raw = raw.strip()
    if raw == "" or raw.lower() in ("0", "false", "no", "none", "clipp"):
        return ""
    if raw.lower() in ("2", "_2", "mt2", "mt"):
        return "_2"
    if raw.startswith("_"):
        return raw
    return f"_{raw}" if raw.isalnum() else ""


def apply_receber_suffix(sql: str) -> str:
    suf = receber_table_suffix()
    if not suf:
        return sql
    out = sql
    for base in _BASES:
        out = re.sub(rf"\b{re.escape(base)}\b", base + suf, out)
    return out


def receber_exige_cliente_com_nf_mt() -> bool:
    raw = os.getenv("CONSTRUNEVES_RECEBER_EXIGE_CLIENTE_NF_MT")
    if raw is None:
        return True
    return raw.strip().lower() not in ("0", "false", "no", "off")


def receber_sql_and_cliente_com_nf_mt(id_cliente_expr: str) -> str:
    """Restringe a clientes com NF de saída MT finalizada (TB_NFVENDA_2). id_cliente_expr: ex. C.ID_CLIENTE, R.ID_CLIENTE."""
    if not receber_exige_cliente_com_nf_mt():
        return ""
    return (
        " AND EXISTS (SELECT 1 FROM TB_NFVENDA_2 NMT WHERE NMT.ID_CLIENTE = "
        + id_cliente_expr.strip()
        + " AND TRIM(COALESCE(NMT.FIM, '')) = 'Finalizado')"
    )


def apply_receber_nf_mt_client_filter_sql(sql: str) -> str:
    """Acrescenta filtro NF MT em SQL de carteira (por_cliente / prazo_medio)."""
    if not receber_exige_cliente_com_nf_mt():
        return sql
    f = receber_sql_and_cliente_com_nf_mt("C.ID_CLIENTE")
    f2 = receber_sql_and_cliente_com_nf_mt("R2.ID_CLIENTE")
    s = sql
    if "AND R.VLR_RESTANTE > 0\nLEFT JOIN" in s:
        s = s.replace(
            "AND R.VLR_RESTANTE > 0\nLEFT JOIN",
            "AND R.VLR_RESTANTE > 0" + f + "\nLEFT JOIN",
            1,
        )
    if "AND R.VLR_RESTANTE > 0\nINNER JOIN" in s:
        s = s.replace(
            "AND R.VLR_RESTANTE > 0\nINNER JOIN",
            "AND R.VLR_RESTANTE > 0" + f + "\nINNER JOIN",
            1,
        )
    if "AND R2.VLR_RESTANTE > 0\n    GROUP BY" in s:
        s = s.replace(
            "AND R2.VLR_RESTANTE > 0\n    GROUP BY",
            "AND R2.VLR_RESTANTE > 0" + f2 + "\n    GROUP BY",
            1,
        )
    return s
