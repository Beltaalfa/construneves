"""
Dashboards por setor — usa SQL versionado em /var/www/construneves/*.sql
e consultas resumo inline (apenas SELECT).
"""
from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any, Callable

from fastapi import APIRouter, HTTPException

REPO_SQL = Path("/var/www/construneves")

router = APIRouter(prefix="/dash", tags=["dashboard"])

_rows_to_dicts: Callable | None = None
_firebird_connection: Callable | None = None


def wire(rows_fn: Callable, conn_cm: Callable) -> None:
    global _rows_to_dicts, _firebird_connection
    _rows_to_dicts = rows_fn
    _firebird_connection = conn_cm


def _load_sql(filename: str) -> str:
    path = REPO_SQL / filename
    if not path.is_file():
        raise HTTPException(status_code=500, detail=f"SQL não encontrado: {filename}")
    return path.read_text(encoding="utf-8", errors="replace").strip().rstrip(";")


def _serialize_cell(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val


def _row_dict_clean(row: dict) -> dict:
    return {k.strip() if isinstance(k, str) else k: _serialize_cell(v) for k, v in row.items()}


def _execute(sql: str, max_rows: int | None = 800) -> tuple[list[str], list[dict]]:
    assert _rows_to_dicts and _firebird_connection
    with _firebird_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)
        cols, all_rows = _rows_to_dicts(cur)
        cur.close()
    if max_rows is not None and len(all_rows) > max_rows:
        all_rows = all_rows[:max_rows]
    clean = [_row_dict_clean(r) for r in all_rows]
    return cols, clean


def _one_row(sql: str) -> dict:
    _, rows = _execute(sql, max_rows=1)
    return rows[0] if rows else {}


@router.get("/contas-a-pagar")
def dash_contas_a_pagar():
    summary_sql = """
    SELECT
      COUNT(DISTINCT P.ID_CTAPAG) AS QTD_TITULOS,
      COUNT(DISTINCT P.ID_FORNEC) AS QTD_FORNECEDORES,
      COALESCE(SUM(P.VLR_CTAPAG - COALESCE(B.VLR_PAGO_TOTAL, 0)), 0) AS SALDO_TOTAL_ABERTO,
      COALESCE(SUM(CASE WHEN P.DT_VENCTO < CURRENT_DATE
        THEN P.VLR_CTAPAG - COALESCE(B.VLR_PAGO_TOTAL, 0) ELSE 0 END), 0) AS SALDO_ATRASADO,
      COALESCE(SUM(CASE WHEN P.DT_VENCTO >= CURRENT_DATE
        THEN P.VLR_CTAPAG - COALESCE(B.VLR_PAGO_TOTAL, 0) ELSE 0 END), 0) AS SALDO_A_VENCER,
      COALESCE(AVG(CAST(P.DT_VENCTO - P.DT_EMISSAO AS DOUBLE PRECISION)), 0) AS PRAZO_MEDIO_DIAS
    FROM TB_CONTA_PAGAR P
    LEFT JOIN (
        SELECT ID_CTAPAG, SUM(VLR_PAGO) AS VLR_PAGO_TOTAL
        FROM TB_CTAPAG_BAIXA
        GROUP BY ID_CTAPAG
    ) B ON B.ID_CTAPAG = P.ID_CTAPAG
    WHERE (P.VLR_CTAPAG - COALESCE(B.VLR_PAGO_TOTAL, 0)) > 0
    """
    try:
        kpis = _one_row(summary_sql)
        analitico = _load_sql("contas_a_pagar_analitico.sql")
        _, rows = _execute(analitico, max_rows=600)
        by_f: dict[str, float] = {}
        for r in rows:
            nome = str(r.get("FORNECEDOR") or "").strip() or "—"
            saldo = float(r.get("SALDO_ABERTO") or 0)
            by_f[nome] = by_f.get(nome, 0.0) + saldo
        top_forn = sorted(by_f.items(), key=lambda x: -x[1])[:12]
        chart_forn = [{"name": a[:35], "valor": round(b, 2)} for a, b in top_forn]
        return {"kpis": kpis, "rows": rows, "chart_top_fornecedores": chart_forn}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _contas_receber_where_aberto() -> str:
    return (
        "(R.CANC IS NULL OR TRIM(R.CANC) = '' OR R.CANC = 'N') AND R.VLR_RESTANTE > 0"
    )


def _merge_indicadores_mes(
    rows_v30: list[dict], rows_pmr: list[dict]
) -> list[dict]:
    """Une série mensal: saldo vencido 30+, % inadimplência 30+ (sobre carteira no mês de venc.) e PMR emissão→baixa por mês da baixa."""

    def _key(r: dict) -> tuple[int, int]:
        return (int(r.get("ANO") or 0), int(r.get("MES_NUM") or 0))

    merged: dict[tuple[int, int], dict[str, Any]] = {}
    for r in rows_v30:
        k = _key(r)
        if k[0] <= 0 or k[1] <= 0:
            continue
        cart = float(r.get("VALOR_CARTEIRA_ABERTO") or 0)
        v30 = float(r.get("VALOR_VENCIDO_30_MAIS") or 0)
        frac = (v30 / cart) if cart > 0 else 0.0
        merged[k] = {
            "ANO": k[0],
            "MES_NUM": k[1],
            "VALOR_VENCIDO_30_MAIS": round(v30, 2),
            "INADIMPLENCIA_30_FRAC": round(frac, 6),
            "PMR_EMISSAO_BAIXA_DIAS": None,
        }
    for r in rows_pmr:
        k = _key(r)
        if k[0] <= 0 or k[1] <= 0:
            continue
        pmr = float(r.get("PMR_EMISSAO_BAIXA_DIAS") or 0)
        if k not in merged:
            merged[k] = {
                "ANO": k[0],
                "MES_NUM": k[1],
                "VALOR_VENCIDO_30_MAIS": 0.0,
                "INADIMPLENCIA_30_FRAC": 0.0,
                "PMR_EMISSAO_BAIXA_DIAS": round(pmr, 2),
            }
        else:
            merged[k]["PMR_EMISSAO_BAIXA_DIAS"] = round(pmr, 2)
    out = sorted(merged.values(), key=lambda x: (x["ANO"], x["MES_NUM"]))
    return out


@router.get("/contas-a-receber")
def dash_contas_a_receber():
    w = _contas_receber_where_aberto()
    summary_sql = f"""
    SELECT
      COUNT(*) AS QTD_TITULOS,
      COUNT(DISTINCT R.ID_CLIENTE) AS QTD_CLIENTES,
      COALESCE(SUM(R.VLR_RESTANTE), 0) AS SALDO_ABERTO,
      COALESCE(SUM(R.VLR_CTAREC), 0) AS VALOR_ORIGINAL_TOTAL,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE THEN R.VLR_RESTANTE ELSE 0 END), 0) AS SALDO_ATRASADO,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO >= CURRENT_DATE THEN R.VLR_RESTANTE ELSE 0 END), 0) AS SALDO_A_VENCER,
      COALESCE(AVG(CAST(R.DT_VENCTO - R.DT_EMISSAO AS DOUBLE PRECISION)), 0) AS PRAZO_MEDIO_TITULO_DIAS,
      (SELECT COUNT(DISTINCT R2.ID_CLIENTE) FROM TB_CONTA_RECEBER R2
       WHERE {w.replace("R.", "R2.")}
         AND R2.DT_VENCTO < DATEADD(DAY, -30, CURRENT_DATE)
      ) AS QTD_CLIENTES_ATRASO_ACIMA_30_DIAS,
      (SELECT COALESCE(SUM(R2.VLR_RESTANTE), 0) FROM TB_CONTA_RECEBER R2
       WHERE {w.replace("R.", "R2.")}
         AND R2.DT_VENCTO < DATEADD(DAY, -30, CURRENT_DATE)
      ) AS VALOR_ATRASO_ACIMA_30_DIAS,
      (SELECT COUNT(DISTINCT R2.ID_CLIENTE) FROM TB_CONTA_RECEBER R2
       WHERE {w.replace("R.", "R2.")}
         AND R2.DT_VENCTO < DATEADD(DAY, -60, CURRENT_DATE)
      ) AS QTD_CLIENTES_ATRASO_ACIMA_60_DIAS,
      (SELECT COALESCE(SUM(R2.VLR_RESTANTE), 0) FROM TB_CONTA_RECEBER R2
       WHERE {w.replace("R.", "R2.")}
         AND R2.DT_VENCTO < DATEADD(DAY, -60, CURRENT_DATE)
      ) AS VALOR_ATRASO_ACIMA_60_DIAS
    FROM TB_CONTA_RECEBER R
    WHERE {w}
    """
    aging_sql = f"""
    SELECT
      COALESCE(SUM(CASE WHEN R.DT_VENCTO >= CURRENT_DATE THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_A_VENCER,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE AND (CURRENT_DATE - R.DT_VENCTO) BETWEEN 1 AND 7
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_1_7,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE AND (CURRENT_DATE - R.DT_VENCTO) BETWEEN 8 AND 15
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_8_15,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE AND (CURRENT_DATE - R.DT_VENCTO) BETWEEN 16 AND 30
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_16_30,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE AND (CURRENT_DATE - R.DT_VENCTO) BETWEEN 31 AND 60
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_31_60,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE AND (CURRENT_DATE - R.DT_VENCTO) BETWEEN 61 AND 90
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_61_90,
      COALESCE(SUM(CASE WHEN R.DT_VENCTO < CURRENT_DATE AND (CURRENT_DATE - R.DT_VENCTO) > 90
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS B_ACIMA_90
    FROM TB_CONTA_RECEBER R
    WHERE {w}
    """
    ano_min_sql = "(CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER) - 1)"
    sql_mes_vendas = f"""
    SELECT
      CAST(EXTRACT(YEAR FROM R.DT_EMISSAO) AS INTEGER) AS ANO,
      CAST(EXTRACT(MONTH FROM R.DT_EMISSAO) AS INTEGER) AS MES_NUM,
      COALESCE(SUM(R.VLR_CTAREC), 0) AS VALOR
    FROM TB_CONTA_RECEBER R
    WHERE {w}
      AND CAST(EXTRACT(YEAR FROM R.DT_EMISSAO) AS INTEGER) >= {ano_min_sql}
    GROUP BY 1, 2
    ORDER BY 1, 2
    """
    sql_mes_recebidos = f"""
    SELECT
      CAST(EXTRACT(YEAR FROM B.DT_BAIXA) AS INTEGER) AS ANO,
      CAST(EXTRACT(MONTH FROM B.DT_BAIXA) AS INTEGER) AS MES_NUM,
      COALESCE(SUM(B.VLR_RECEB), 0) AS VALOR
    FROM TB_CTAREC_BAIXA B
    INNER JOIN TB_CONTA_RECEBER R ON R.ID_CTAREC = B.ID_CTAREC
    WHERE (R.CANC IS NULL OR TRIM(R.CANC) = '' OR R.CANC = 'N')
      AND CAST(EXTRACT(YEAR FROM B.DT_BAIXA) AS INTEGER) >= {ano_min_sql}
    GROUP BY 1, 2
    ORDER BY 1, 2
    """
    sql_mes_pendentes = f"""
    SELECT
      CAST(EXTRACT(YEAR FROM R.DT_VENCTO) AS INTEGER) AS ANO,
      CAST(EXTRACT(MONTH FROM R.DT_VENCTO) AS INTEGER) AS MES_NUM,
      COALESCE(SUM(R.VLR_RESTANTE), 0) AS VALOR
    FROM TB_CONTA_RECEBER R
    WHERE {w}
      AND CAST(EXTRACT(YEAR FROM R.DT_VENCTO) AS INTEGER) >= {ano_min_sql}
    GROUP BY 1, 2
    ORDER BY 1, 2
    """
    sql_ind_v30_mes = f"""
    SELECT
      CAST(EXTRACT(YEAR FROM R.DT_VENCTO) AS INTEGER) AS ANO,
      CAST(EXTRACT(MONTH FROM R.DT_VENCTO) AS INTEGER) AS MES_NUM,
      COALESCE(SUM(CASE WHEN (CURRENT_DATE - R.DT_VENCTO) >= 30
        THEN R.VLR_RESTANTE ELSE 0 END), 0) AS VALOR_VENCIDO_30_MAIS,
      COALESCE(SUM(R.VLR_RESTANTE), 0) AS VALOR_CARTEIRA_ABERTO
    FROM TB_CONTA_RECEBER R
    WHERE {w}
      AND CAST(EXTRACT(YEAR FROM R.DT_VENCTO) AS INTEGER) >= {ano_min_sql}
    GROUP BY 1, 2
    ORDER BY 1, 2
    """
    sql_pmr_emissao_baixa_mes = """
    SELECT
      CAST(EXTRACT(YEAR FROM B.DT_BAIXA) AS INTEGER) AS ANO,
      CAST(EXTRACT(MONTH FROM B.DT_BAIXA) AS INTEGER) AS MES_NUM,
      AVG(CAST(B.DT_BAIXA - R.DT_EMISSAO AS DOUBLE PRECISION)) AS PMR_EMISSAO_BAIXA_DIAS
    FROM TB_CTAREC_BAIXA B
    INNER JOIN TB_CONTA_RECEBER R ON R.ID_CTAREC = B.ID_CTAREC
    WHERE (R.CANC IS NULL OR TRIM(R.CANC) = '' OR R.CANC = 'N')
      AND CAST(EXTRACT(YEAR FROM B.DT_BAIXA) AS INTEGER) >= (CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER) - 1)
    GROUP BY 1, 2
    ORDER BY 1, 2
    """
    try:
        kpis = _one_row(summary_sql)
        aging = _one_row(aging_sql)
        chart_atraso = [
            {"name": "A vencer", "valor": round(float(aging.get("B_A_VENCER") or 0), 2)},
            {"name": "1 a 7 dias", "valor": round(float(aging.get("B_1_7") or 0), 2)},
            {"name": "8 a 15 dias", "valor": round(float(aging.get("B_8_15") or 0), 2)},
            {"name": "16 a 30 dias", "valor": round(float(aging.get("B_16_30") or 0), 2)},
            {"name": "31 a 60 dias", "valor": round(float(aging.get("B_31_60") or 0), 2)},
            {"name": "61 a 90 dias", "valor": round(float(aging.get("B_61_90") or 0), 2)},
            {"name": "Acima de 90 dias", "valor": round(float(aging.get("B_ACIMA_90") or 0), 2)},
        ]
        por_cliente = _load_sql("contas_a_receber_por_cliente.sql")
        _, rows_pc = _execute(por_cliente, max_rows=None)
        _, mes_vendas = _execute(sql_mes_vendas, max_rows=None)
        _, mes_recebidos = _execute(sql_mes_recebidos, max_rows=None)
        _, mes_pendentes = _execute(sql_mes_pendentes, max_rows=None)
        _, rows_v30 = _execute(sql_ind_v30_mes, max_rows=None)
        _, rows_pmr_baixa = _execute(sql_pmr_emissao_baixa_mes, max_rows=None)
        analitico = _load_sql("contas_receber_analitico_prazo_medio.sql")
        _, rows_det = _execute(analitico, max_rows=None)
        indicadores_mes = _merge_indicadores_mes(rows_v30, rows_pmr_baixa)
        return {
            "kpis": kpis,
            "por_cliente": rows_pc,
            "titulos": rows_det,
            "chart_tempo_atraso": chart_atraso,
            "mes_vendas": mes_vendas,
            "mes_recebidos": mes_recebidos,
            "mes_pendentes": mes_pendentes,
            "indicadores_mes": indicadores_mes,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/estoque/giro")
def dash_estoque_giro():
    try:
        sql = _load_sql("analise_giro_estoque.sql")
        _, rows = _execute(sql, max_rows=500)
        cats: dict[str, int] = {}
        status: dict[str, int] = {}
        for r in rows:
            c = str(r.get("CATEGORIA_ACAO") or "—")
            cats[c] = cats.get(c, 0) + 1
            s = str(r.get("STATUS_COBERTURA") or "—")
            status[s] = status.get(s, 0) + 1
        pie_acao = [{"name": k, "value": v} for k, v in sorted(cats.items(), key=lambda x: -x[1])]
        pie_status = [{"name": k, "value": v} for k, v in sorted(status.items(), key=lambda x: -x[1])]
        return {
            "kpis": {
                "linhas_amostra": len(rows),
                "produtos_promocao": cats.get("Produtos para Promocao", 0),
                "produtos_reposicao": cats.get("Produtos para Reposicao", 0),
                "produtos_parados": cats.get("Produtos Parados", 0),
                "estavel": cats.get("Estavel", 0),
            },
            "rows": rows,
            "chart_categoria_acao": pie_acao,
            "chart_status_cobertura": pie_status,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/estoque/bcg")
def dash_estoque_bcg():
    try:
        sql = _load_sql("matriz_bcg_produtos_2.sql")
        _, rows = _execute(sql, max_rows=400)
        quad: dict[str, int] = {}
        for r in rows:
            q = str(r.get("CLASSE_BCG") or "—")
            quad[q] = quad.get(q, 0) + 1
        chart_quad = [{"name": k, "value": v} for k, v in sorted(quad.items(), key=lambda x: -x[1])]
        return {"kpis": {"total_produtos": len(rows)}, "rows": rows, "chart_quadrantes": chart_quad}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/precos/markup-validacao")
def dash_markup_validacao():
    try:
        sql = _load_sql("validacao_markup_produtos.sql")
        _, rows = _execute(sql, max_rows=None)
        div = sum(1 for r in rows if str(r.get("VALIDACAO")) == "DIVERGENTE")
        ok = sum(1 for r in rows if str(r.get("VALIDACAO")) == "OK")
        sem = sum(1 for r in rows if str(r.get("VALIDACAO")) == "SEM CUSTO")
        margens_div: list[float] = []
        markup_lt_40 = 0
        for r in rows:
            if str(r.get("VALIDACAO")) != "DIVERGENTE":
                continue
            m = r.get("MARGEM_BRUTA_PCT")
            if m is not None:
                margens_div.append(float(m))
        for r in rows:
            try:
                cost = float(r.get("CUSTO") or 0)
                mc = r.get("MARKUP_CALCULADO_PCT")
                if cost > 0 and mc is not None and float(mc) < 40:
                    markup_lt_40 += 1
            except (TypeError, ValueError):
                continue
        avg_mdiv = round(sum(margens_div) / len(margens_div), 2) if margens_div else 0.0
        crit = 0
        for r in rows:
            try:
                cost = float(r.get("CUSTO") or 0)
                mb = r.get("MARGEM_BRUTA_PCT")
                if cost > 0 and mb is not None and float(mb) < 10:
                    crit += 1
            except (TypeError, ValueError):
                continue
        difs = [
            abs(float(r.get("DIF_MARKUP_PCT") or 0))
            for r in rows
            if str(r.get("VALIDACAO")) == "DIVERGENTE"
        ]
        max_dif = round(max(difs), 2) if difs else 0.0
        n = len(rows)
        kpis = {
            "total_produtos": n,
            "divergentes": div,
            "ok": ok,
            "sem_custo": sem,
            "pct_divergentes": round(100.0 * div / n, 2) if n else 0.0,
            "margem_bruta_media_divergentes": avg_mdiv,
            "produtos_margem_bruta_menor_10": crit,
            "maior_dif_markup_abs_pp": max_dif,
            "produtos_markup_calc_menor_40": markup_lt_40,
        }
        return {"kpis": kpis, "rows": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
