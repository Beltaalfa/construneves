"""
Adiciona produtos com estoque negativo à **ordem de compra aberta actual** (a mais recente
por data, não finalizada nem cancelada — mesmo critério que `ped_compra_aberto_lista.sql`).

- Se o item já existir na ordem: **soma** a quantidade em falta (|QTD_ATUAL|) em `qtd_item`.
- Se não existir: **INSERT** na `tb_ped_compra_ordem_item`.

Opcional: gerador para PK da linha (`CONSTRUNEVES_PED_COMPRA_ITEM_GEN`) se a tabela exigir ID da linha.
Coluna NOT NULL típica `VLR_UNIT`: por defeito inclui-se com valor `CONSTRUNEVES_PED_COMPRA_VLR_UNIT_DEFAULT` (0).
Para omitir a coluna no INSERT: `CONSTRUNEVES_PED_COMPRA_COL_VLR_UNIT=` (vazio explícito no .env).
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Callable

from estoque_alerta import sql_produtos_negativos


def _env(k: str, d: str = "") -> str:
    return (os.getenv(k) or d).strip()


_IDENT_RE = re.compile(r"^[A-Z_][A-Z0-9_]*$")


def _sql_ident(name: str, label: str) -> str:
    s = (name or "").strip().upper()
    if not s or not _IDENT_RE.match(s):
        raise ValueError(f"{label} inválido ou vazio: {name!r}")
    return s


def _vlr_unit_column() -> str | None:
    """
    None = não incluir VLR_UNIT no INSERT (só se .env tiver CONSTRUNEVES_PED_COMPRA_COL_VLR_UNIT= vazio).
    Por omissão (variável ausente) usa VLR_UNIT.
    """
    raw = os.getenv("CONSTRUNEVES_PED_COMPRA_COL_VLR_UNIT")
    if raw is not None and not raw.strip():
        return None
    name = (raw or "VLR_UNIT").strip()
    return _sql_ident(name, "CONSTRUNEVES_PED_COMPRA_COL_VLR_UNIT")


def _vlr_unit_value() -> float:
    s = (_env("CONSTRUNEVES_PED_COMPRA_VLR_UNIT_DEFAULT", "0") or "0").replace(",", ".")
    try:
        return float(s)
    except ValueError as e:
        raise ValueError(
            "CONSTRUNEVES_PED_COMPRA_VLR_UNIT_DEFAULT deve ser numérico (ex.: 0 ou 12.50)"
        ) from e


def _pick_id_ped_compra_ordem(row: dict | None) -> int | None:
    if not row:
        return None
    for k, v in row.items():
        if str(k).strip().upper() == "ID_PED_COMPRA_ORDEM" and v is not None:
            return int(v)
    return None


def _row_int(row: dict, logical: str) -> int:
    u = logical.upper()
    for k, v in row.items():
        if str(k).strip().upper() == u and v is not None:
            return int(v)
    raise KeyError(logical)


SQL_ORDEM_COMPRA_ATUAL = """
SELECT FIRST 1 a.id_ped_compra_ordem AS id_ped_compra_ordem
FROM tb_ped_compra_ordem a
JOIN tb_ped_compra_status e ON e.id_status = a.ped_compra_status
WHERE TRIM(COALESCE(e.descricao, '')) NOT IN ('Finalizado', 'Cancelado')
ORDER BY a.dt_ordem DESC, a.id_ped_compra_ordem DESC
"""

SQL_PRODUTOS_NAO_POSITIVOS = """
SELECT
    P.ID_IDENTIFICADOR,
    COALESCE(P.QTD_ATUAL, 0) AS QTD_ATUAL,
    COALESCE(P.QTD_MINIM, 0) AS QTD_MINIM
FROM TB_EST_PRODUTO_2 P
WHERE COALESCE(P.QTD_ATUAL, 0) <= 0
ORDER BY P.ID_IDENTIFICADOR
"""


def _state_auto_path() -> Path:
    p = _env("CONSTRUNEVES_PED_COMPRA_AUTO_ESTADO_PATH", "")
    if p:
        return Path(p)
    return Path("/var/www/construneves/data/ped_compra_auto_nao_positivo_state.json")


def _load_auto_state() -> dict[str, Any]:
    path = _state_auto_path()
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save_auto_state(data: dict[str, Any]) -> None:
    path = _state_auto_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")


def _qty_para_inserir_transicao(row: dict) -> float:
    qtd_atual = float(row.get("QTD_ATUAL") or 0)
    qtd_minim = float(row.get("QTD_MINIM") or 0)
    sugestao = qtd_minim - qtd_atual
    if sugestao > 0:
        return float(round(sugestao, 4))
    if qtd_atual < 0:
        return float(round(abs(qtd_atual), 4))
    return 0.0


def _upsert_itens_em_ordem(
    *,
    rows: list[dict],
    id_ped: int,
    tab_item_i: str,
    col_ped_i: str,
    col_ident_i: str,
    col_qtd_i: str,
    col_item_pk_i: str,
    col_vlr_i: str | None,
    vlr_ins: float,
    gen_item_i: str,
    conn_cm: Callable[..., Any],
    qty_fn: Callable[[dict], float],
) -> tuple[int, int]:
    sql_sel_existe = (
        f"SELECT FIRST 1 {col_qtd_i} AS qtd_atual FROM {tab_item_i} b "
        f"WHERE b.{col_ped_i} = ? AND b.{col_ident_i} = ?"
    )
    if col_vlr_i:
        if gen_item_i:
            sql_ins = (
                f"INSERT INTO {tab_item_i} ({col_item_pk_i}, {col_ped_i}, {col_ident_i}, "
                f"{col_qtd_i}, {col_vlr_i}) VALUES (?, ?, ?, ?, ?)"
            )
        else:
            sql_ins = (
                f"INSERT INTO {tab_item_i} ({col_ped_i}, {col_ident_i}, {col_qtd_i}, {col_vlr_i}) "
                f"VALUES (?, ?, ?, ?)"
            )
    else:
        if gen_item_i:
            sql_ins = (
                f"INSERT INTO {tab_item_i} ({col_item_pk_i}, {col_ped_i}, {col_ident_i}, {col_qtd_i}) "
                f"VALUES (?, ?, ?, ?)"
            )
        else:
            sql_ins = (
                f"INSERT INTO {tab_item_i} ({col_ped_i}, {col_ident_i}, {col_qtd_i}) VALUES (?, ?, ?)"
            )
    sql_upd = (
        f"UPDATE {tab_item_i} SET {col_qtd_i} = COALESCE({col_qtd_i}, 0) + ? "
        f"WHERE {col_ped_i} = ? AND {col_ident_i} = ?"
    )

    inseridos = 0
    actualizados = 0
    with conn_cm() as conn:
        cur = conn.cursor()
        try:
            for r in rows:
                iid = _row_int(r, "ID_IDENTIFICADOR")
                q = float(qty_fn(r) or 0)
                if q <= 0:
                    continue
                cur.execute(sql_sel_existe, (id_ped, iid))
                ex = cur.fetchone()
                if ex is not None:
                    cur.execute(sql_upd, (q, id_ped, iid))
                    actualizados += 1
                else:
                    if gen_item_i:
                        cur.execute(f"SELECT GEN_ID({gen_item_i}, 1) FROM RDB$DATABASE")
                        fr = cur.fetchone()
                        if not fr:
                            raise RuntimeError("GEN_ID linha pedido compra falhou")
                        id_lin = int(fr[0])
                        if col_vlr_i:
                            cur.execute(sql_ins, (id_lin, id_ped, iid, q, vlr_ins))
                        else:
                            cur.execute(sql_ins, (id_lin, id_ped, iid, q))
                    else:
                        if col_vlr_i:
                            cur.execute(sql_ins, (id_ped, iid, q, vlr_ins))
                        else:
                            cur.execute(sql_ins, (id_ped, iid, q))
                    inseridos += 1
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    return inseridos, actualizados


def run_auto_adicionar_nao_positivos_em_transicao(
    _execute: Callable[..., tuple[list[str], list[dict]]],
    conn_cm: Callable[..., Any],
) -> dict[str, Any]:
    """
    Daqui pra frente: quando um item cruza para QTD_ATUAL <= 0 (zero/negativo), adiciona
    automaticamente na ordem de compra aberta. Primeira execução só inicializa estado.
    """
    if _env("CONSTRUNEVES_PED_COMPRA_AUTO_NAO_POSITIVO", "").lower() not in (
        "1",
        "true",
        "yes",
        "sim",
        "on",
    ):
        return {"ok": True, "skipped": True, "reason": "CONSTRUNEVES_PED_COMPRA_AUTO_NAO_POSITIVO desligado"}

    tab_item = _env("CONSTRUNEVES_PED_COMPRA_ITEM_TAB", "TB_PED_COMPRA_ORDEM_ITEM")
    col_ped = _env("CONSTRUNEVES_PED_COMPRA_COL_PED", "ID_PED_COMPRA_ORDEM")
    col_ident = _env("CONSTRUNEVES_PED_COMPRA_COL_IDENT", "ID_IDENTIFICADOR")
    col_qtd = _env("CONSTRUNEVES_PED_COMPRA_COL_QTD", "QTD_ITEM")
    col_item_pk = _env("CONSTRUNEVES_PED_COMPRA_ITEM_PK", "ID_PED_COMPRA_ORDEM_ITEM")
    gen_item = _env("CONSTRUNEVES_PED_COMPRA_ITEM_GEN", "").strip()
    try:
        tab_item_i = _sql_ident(tab_item, "CONSTRUNEVES_PED_COMPRA_ITEM_TAB")
        col_ped_i = _sql_ident(col_ped, "CONSTRUNEVES_PED_COMPRA_COL_PED")
        col_ident_i = _sql_ident(col_ident, "CONSTRUNEVES_PED_COMPRA_COL_IDENT")
        col_qtd_i = _sql_ident(col_qtd, "CONSTRUNEVES_PED_COMPRA_COL_QTD")
        col_item_pk_i = _sql_ident(col_item_pk, "CONSTRUNEVES_PED_COMPRA_ITEM_PK")
        col_vlr_i = _vlr_unit_column()
        vlr_ins = _vlr_unit_value()
        gen_item_i = _sql_ident(gen_item, "CONSTRUNEVES_PED_COMPRA_ITEM_GEN") if gen_item else ""
    except ValueError as e:
        return {"ok": False, "erro": str(e)}

    _, now_rows = _execute(SQL_PRODUTOS_NAO_POSITIVOS.strip(), max_rows=None)
    now_ids = {str(int(r["ID_IDENTIFICADOR"])) for r in now_rows if r.get("ID_IDENTIFICADOR") is not None}
    state = _load_auto_state()
    last_ids = {str(x) for x in (state.get("ids_nao_positivos") or []) if str(x).strip()}
    init = bool(state.get("inicializado"))
    if not init:
        _save_auto_state({"inicializado": True, "ids_nao_positivos": sorted(now_ids, key=int)})
        return {"ok": True, "inicializado": True, "novos": 0, "nao_positivos_agora": len(now_ids)}

    novos = now_ids - last_ids
    if not novos:
        _save_auto_state({"inicializado": True, "ids_nao_positivos": sorted(now_ids, key=int)})
        return {"ok": True, "novos": 0, "nao_positivos_agora": len(now_ids)}

    novos_rows = [r for r in now_rows if str(int(r["ID_IDENTIFICADOR"])) in novos]
    _, ord_rows = _execute(SQL_ORDEM_COMPRA_ATUAL.strip(), max_rows=1)
    id_ped = _pick_id_ped_compra_ordem(ord_rows[0] if ord_rows else None)
    if id_ped is None:
        return {
            "ok": False,
            "erro": "Auto pedido compra: não há ordem de compra em aberto.",
            "novos": len(novos_rows),
        }

    inseridos, actualizados = _upsert_itens_em_ordem(
        rows=novos_rows,
        id_ped=id_ped,
        tab_item_i=tab_item_i,
        col_ped_i=col_ped_i,
        col_ident_i=col_ident_i,
        col_qtd_i=col_qtd_i,
        col_item_pk_i=col_item_pk_i,
        col_vlr_i=col_vlr_i,
        vlr_ins=vlr_ins,
        gen_item_i=gen_item_i,
        conn_cm=conn_cm,
        qty_fn=_qty_para_inserir_transicao,
    )
    _save_auto_state({"inicializado": True, "ids_nao_positivos": sorted(now_ids, key=int)})
    return {
        "ok": True,
        "novos": len(novos_rows),
        "inseridos": inseridos,
        "actualizados": actualizados,
        "id_ped_compra_ordem": id_ped,
        "nao_positivos_agora": len(now_ids),
    }


def run_adicionar_negativos_ped_compra_aberto(
    _execute: Callable[..., tuple[list[str], list[dict]]],
    conn_cm: Callable[..., Any],
) -> dict[str, Any]:
    if _env("CONSTRUNEVES_PED_COMPRA_NEGATIVOS", "").lower() not in (
        "1",
        "true",
        "yes",
        "sim",
        "on",
    ):
        return {
            "ok": False,
            "erro": "Defina CONSTRUNEVES_PED_COMPRA_NEGATIVOS=1 no .env da API (painel-api) para usar esta acção.",
        }

    tab_item = _env("CONSTRUNEVES_PED_COMPRA_ITEM_TAB", "TB_PED_COMPRA_ORDEM_ITEM")
    col_ped = _env("CONSTRUNEVES_PED_COMPRA_COL_PED", "ID_PED_COMPRA_ORDEM")
    col_ident = _env("CONSTRUNEVES_PED_COMPRA_COL_IDENT", "ID_IDENTIFICADOR")
    col_qtd = _env("CONSTRUNEVES_PED_COMPRA_COL_QTD", "QTD_ITEM")
    col_item_pk = _env("CONSTRUNEVES_PED_COMPRA_ITEM_PK", "ID_PED_COMPRA_ORDEM_ITEM")
    gen_item = _env("CONSTRUNEVES_PED_COMPRA_ITEM_GEN", "").strip()
    id_ordem_fixo = _env("CONSTRUNEVES_PED_COMPRA_ID_ORDEM", "").strip()

    try:
        tab_item_i = _sql_ident(tab_item, "CONSTRUNEVES_PED_COMPRA_ITEM_TAB")
        col_ped_i = _sql_ident(col_ped, "CONSTRUNEVES_PED_COMPRA_COL_PED")
        col_ident_i = _sql_ident(col_ident, "CONSTRUNEVES_PED_COMPRA_COL_IDENT")
        col_qtd_i = _sql_ident(col_qtd, "CONSTRUNEVES_PED_COMPRA_COL_QTD")
        col_item_pk_i = _sql_ident(col_item_pk, "CONSTRUNEVES_PED_COMPRA_ITEM_PK")
        col_vlr_i = _vlr_unit_column()
        vlr_ins = _vlr_unit_value()
        if gen_item:
            gen_item_i = _sql_ident(gen_item, "CONSTRUNEVES_PED_COMPRA_ITEM_GEN")
        else:
            gen_item_i = ""
    except ValueError as e:
        return {"ok": False, "erro": str(e)}

    if _env("CONSTRUNEVES_PED_COMPRA_DRY_RUN", "").lower() in ("1", "true", "yes", "sim"):
        _, rows = _execute(sql_produtos_negativos(), max_rows=None)
        _, ord_rows = _execute(SQL_ORDEM_COMPRA_ATUAL.strip(), max_rows=1)
        id_ped = _pick_id_ped_compra_ordem(ord_rows[0] if ord_rows else None)
        return {
            "ok": True,
            "dry_run": True,
            "id_ped_compra_ordem": id_ped,
            "linhas_negativas": len(rows),
            "vlr_unit_col": col_vlr_i,
            "vlr_unit_valor_insert": vlr_ins if col_vlr_i else None,
            "preview": rows[:80],
        }

    _, rows = _execute(sql_produtos_negativos(), max_rows=None)

    def _qtd_neg(r: dict) -> float:
        for k, v in r.items():
            if str(k).strip().upper() == "QTD_ATUAL":
                return float(v or 0)
        return 0.0

    valid = [r for r in rows if abs(_qtd_neg(r)) > 0]
    if not valid:
        return {
            "ok": True,
            "skipped": True,
            "reason": "Nenhum produto com estoque negativo.",
            "id_ped_compra_ordem": None,
        }

    if id_ordem_fixo:
        try:
            id_ped = int(id_ordem_fixo)
        except ValueError:
            return {"ok": False, "erro": "CONSTRUNEVES_PED_COMPRA_ID_ORDEM deve ser um inteiro."}
    else:
        _, ord_rows = _execute(SQL_ORDEM_COMPRA_ATUAL.strip(), max_rows=1)
        id_ped = _pick_id_ped_compra_ordem(ord_rows[0] if ord_rows else None)
        if id_ped is None:
            return {
                "ok": False,
                "erro": "Não há pedido de compra em aberto (finalizado/cancelado excluídos). Crie ou reabra uma ordem.",
            }

    inseridos, actualizados = _upsert_itens_em_ordem(
        rows=valid,
        id_ped=id_ped,
        tab_item_i=tab_item_i,
        col_ped_i=col_ped_i,
        col_ident_i=col_ident_i,
        col_qtd_i=col_qtd_i,
        col_item_pk_i=col_item_pk_i,
        col_vlr_i=col_vlr_i,
        vlr_ins=vlr_ins,
        gen_item_i=gen_item_i,
        conn_cm=conn_cm,
        qty_fn=lambda r: abs(_qtd_neg(r)),
    )

    return {
        "ok": True,
        "id_ped_compra_ordem": id_ped,
        "inseridos": inseridos,
        "actualizados": actualizados,
        "produtos_negativos": len(valid),
    }
