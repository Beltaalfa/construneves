"""
Apontamentos de cobrança no MT (TB_CLI_CONT_AGENDADO).

Lê e grava diretamente no Firebird do MT para manter aderência ao sistema legado.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import firebirdsql
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/cobranca", tags=["cobranca"])


def _env(k: str, d: str = "") -> str:
    return (os.getenv(k) or d).strip()


@contextmanager
def _conn():
    conn = firebirdsql.connect(
        host=_env("FIREBIRD_HOST", "127.0.0.1"),
        database=_env("FIREBIRD_DATABASE"),
        user=_env("FIREBIRD_USER", "SYSDBA"),
        password=_env("FIREBIRD_PASSWORD"),
        port=int(_env("FIREBIRD_PORT", "3050") or "3050"),
        charset=_env("FIREBIRD_CHARSET_COBRANCA", "WIN1252"),
    )
    try:
        yield conn
    finally:
        conn.close()


def _rows_to_dicts(cur) -> list[dict[str, Any]]:
    if not cur.description:
        return []
    cols = [d[0].strip() if isinstance(d[0], str) else str(d[0]) for d in cur.description]
    out: list[dict[str, Any]] = []
    for row in cur.fetchall():
        line: dict[str, Any] = {}
        for i, c in enumerate(cols):
            v = row[i]
            if hasattr(v, "isoformat"):
                v = v.isoformat()
            line[c] = v
        out.append(line)
    return out


def _id_forma_by_descricao(cur, descricao: str) -> int | None:
    d = (descricao or "").strip()
    if not d:
        return None
    cur.execute(
        """
        SELECT FIRST 1 ID_FORMAS
        FROM TB_CLI_FMAS_CONTATO_SIS
        WHERE DESCRICAO CONTAINING ?
        ORDER BY ID_FORMAS
        """,
        (d,),
    )
    r = cur.fetchone()
    if r and r[0] is not None:
        return int(r[0])
    return None


class ApontamentoIn(BaseModel):
    id_cliente: str = Field(default="", max_length=40)
    cliente: str = Field(default="", max_length=140)
    contato: str = Field(default="", max_length=120)
    telefone: str = Field(default="", max_length=40)
    assunto: str = Field(default="", max_length=120)
    forma_contato: str = Field(default="WhatsApp", max_length=40)
    funcionario: str = Field(default="", max_length=120)
    conteudo: str = Field(..., min_length=1, max_length=5000)
    efetuado: bool = False


class ApontamentoPatch(BaseModel):
    efetuado: bool


@router.get("/apontamentos")
def get_apontamentos(
    q: str = Query(default="", max_length=120),
    id_cliente: int | None = Query(default=None, ge=1),
    somente_pendentes: bool = Query(default=False),
    limit: int = Query(default=300, ge=1, le=1000),
):
    where: list[str] = []
    params: list[Any] = []
    if id_cliente is not None:
        where.append("A.ID_CLIENTE = ?")
        params.append(id_cliente)
    qq = q.strip()
    if qq:
        where.append(
            "("
            "C.NOME CONTAINING ? OR A.CONTATO CONTAINING ? OR A.ASSUNTO CONTAINING ? OR "
            "A.CONTEUDO CONTAINING ? OR F.DESCRICAO CONTAINING ? OR FN.NOME CONTAINING ?"
            ")"
        )
        params.extend([qq, qq, qq, qq, qq, qq])
    if somente_pendentes:
        where.append("A.DT_CONTATO IS NULL")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    sql = f"""
        SELECT FIRST {int(limit)}
            A.ID_CONTATO AS ID,
            A.ID_CLIENTE,
            TRIM(COALESCE(C.NOME, '')) AS CLIENTE,
            TRIM(COALESCE(A.CONTATO, '')) AS CONTATO,
            TRIM(COALESCE(CAST(C.DDD_CELUL AS VARCHAR(8)), '')) || TRIM(COALESCE(C.FONE_CELUL, '')) AS TELEFONE,
            TRIM(COALESCE(A.ASSUNTO, '')) AS ASSUNTO,
            TRIM(COALESCE(F.DESCRICAO, '')) AS FORMA_CONTATO,
            TRIM(COALESCE(FN.NOME, '')) AS FUNCIONARIO,
            CAST(A.CONTEUDO AS BLOB SUB_TYPE TEXT) AS CONTEUDO,
            A.DT_AGENDA,
            A.HR_AGENDA,
            A.DT_CONTATO,
            A.HR_CONTATO,
            CASE WHEN A.DT_CONTATO IS NOT NULL THEN 1 ELSE 0 END AS EFETUADO,
            COALESCE(CAST(A.DT_CONTATO AS TIMESTAMP), CAST(A.DT_AGENDA AS TIMESTAMP)) AS CREATED_AT
        FROM TB_CLI_CONT_AGENDADO A
        LEFT JOIN TB_CLIENTE C ON C.ID_CLIENTE = A.ID_CLIENTE
        LEFT JOIN TB_CLI_FMAS_CONTATO_SIS F ON F.ID_FORMAS = A.ID_FORMAS
        LEFT JOIN TB_FUNCIONARIO FN ON FN.ID_FUNCIONARIO = A.ID_FUNC
        {where_sql}
        ORDER BY COALESCE(A.DT_CONTATO, A.DT_AGENDA) DESC, COALESCE(A.HR_CONTATO, A.HR_AGENDA) DESC, A.ID_CONTATO DESC
    """
    try:
        with _conn() as conn:
            cur = conn.cursor()
            cur.execute(sql, tuple(params))
            rows = _rows_to_dicts(cur)
            cur.close()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"rows": rows, "count": len(rows), "source": "mt"}


@router.post("/apontamentos")
def post_apontamento(body: ApontamentoIn):
    try:
        id_cliente = int((body.id_cliente or "").strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Informe um ID cliente numérico (MT).")
    if id_cliente <= 0:
        raise HTTPException(status_code=400, detail="ID cliente inválido.")
    agora = datetime.now()
    dt_hoje = agora.date()
    hr_agora = agora.time().replace(microsecond=0)
    try:
        with _conn() as conn:
            cur = conn.cursor()
            id_formas = _id_forma_by_descricao(cur, body.forma_contato or "WhatsApp") or 7
            id_func_default = int(_env("COBRANCA_ID_FUNC_DEFAULT", "1") or "1")
            cur.execute(
                """
                INSERT INTO TB_CLI_CONT_AGENDADO
                (ID_CONTATO, DT_AGENDA, HR_AGENDA, CONTATO, ASSUNTO, ID_FORMAS, ID_CLIENTE, CONTEUDO, ID_FUNC, ID_FUNCEMI)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    0,
                    dt_hoje,
                    hr_agora,
                    (body.contato or body.cliente or "").strip()[:120],
                    (body.assunto or "").strip()[:120],
                    id_formas,
                    id_cliente,
                    body.conteudo.strip(),
                    id_func_default,
                    id_func_default,
                ),
            )
            conn.commit()
            cur.execute("SELECT GEN_ID(GEN_TB_CLI_CONT_AGEND_ID, 0) FROM RDB$DATABASE")
            rr = cur.fetchone()
            new_id = int(rr[0]) if rr and rr[0] is not None else None
            cur.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"ok": True, "id": new_id, "source": "mt"}


@router.patch("/apontamentos/{item_id}")
def patch_apontamento(item_id: str, body: ApontamentoPatch):
    try:
        iid = int(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido.")
    agora = datetime.now()
    dt_hoje = agora.date()
    hr_agora = agora.time().replace(microsecond=0)
    try:
        with _conn() as conn:
            cur = conn.cursor()
            if body.efetuado:
                cur.execute(
                    """
                    UPDATE TB_CLI_CONT_AGENDADO
                    SET DT_CONTATO = ?, HR_CONTATO = ?
                    WHERE ID_CONTATO = ?
                    """,
                    (dt_hoje, hr_agora, iid),
                )
            else:
                cur.execute(
                    """
                    UPDATE TB_CLI_CONT_AGENDADO
                    SET DT_CONTATO = NULL, HR_CONTATO = NULL
                    WHERE ID_CONTATO = ?
                    """,
                    (iid,),
                )
            affected = int(cur.rowcount or 0)
            conn.commit()
            cur.close()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    if affected <= 0:
        raise HTTPException(status_code=404, detail="Apontamento não encontrado.")
    return {"ok": True, "id": iid, "source": "mt"}


@router.delete("/apontamentos/{item_id}")
def delete_apontamento(item_id: str):
    try:
        iid = int(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido.")
    try:
        with _conn() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM TB_CLI_CONT_AGENDADO WHERE ID_CONTATO = ?", (iid,))
            affected = int(cur.rowcount or 0)
            conn.commit()
            cur.close()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    if affected <= 0:
        raise HTTPException(status_code=404, detail="Apontamento não encontrado.")
    return {"ok": True, "deleted": 1, "id": iid, "source": "mt"}
