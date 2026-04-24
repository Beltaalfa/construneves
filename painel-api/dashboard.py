"""
Dashboards por setor — usa SQL versionado em /var/www/construneves/*.sql
e consultas resumo inline (apenas SELECT).
"""
from __future__ import annotations

import calendar
import os
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Any, Callable

from fastapi import APIRouter, Header, HTTPException, Query

from receber_tables import (
    apply_receber_nf_mt_client_filter_sql as _receber_nf_mt_filter,
    apply_receber_suffix as _receber_sql,
    receber_sql_and_cliente_com_nf_mt as _receber_nf_mt,
)

REPO_SQL = Path("/var/www/construneves")

router = APIRouter(prefix="/dash", tags=["dashboard"])

_MESES_PT_CURTO = (
    "",
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
)


def _merge_evolucao_pagar_mes(
    rows_pago: list[dict], rows_aberto: list[dict]
) -> list[dict]:
    """12 linhas (jan–dez): pago no mês (baixas) vs saldo em aberto por mês de vencimento."""
    acum: dict[int, dict[str, float]] = {
        m: {"pago": 0.0, "a_pagar": 0.0} for m in range(1, 13)
    }
    for r in rows_pago:
        m = int(r.get("MES_NUM") or 0)
        if 1 <= m <= 12:
            acum[m]["pago"] = float(r.get("VALOR") or 0)
    for r in rows_aberto:
        m = int(r.get("MES_NUM") or 0)
        if 1 <= m <= 12:
            acum[m]["a_pagar"] = float(r.get("VALOR") or 0)
    out = []
    for m in range(1, 13):
        out.append(
            {
                "mes_num": m,
                "name": _MESES_PT_CURTO[m],
                "pago": round(acum[m]["pago"], 2),
                "a_pagar": round(acum[m]["a_pagar"], 2),
            }
        )
    return out

_rows_to_dicts: Callable | None = None
_firebird_connection: Callable | None = None
_CONTAS_BANCARIAS_IGNORAR = frozenset({1, 2, 3})
# Conta de adquirente (ex.: SIPAG) — entra em “cartões a receber”, fora do total bancos.
_ID_CONTA_SIPAG_CARTOES = 6


def wire(rows_fn: Callable, conn_cm: Callable) -> None:
    global _rows_to_dicts, _firebird_connection
    _rows_to_dicts = rows_fn
    _firebird_connection = conn_cm


def firebird_conn_context():
    """Context manager Firebird (transacções com commit explícito). Só após `wire()`."""
    if _firebird_connection is None:
        raise RuntimeError("dashboard.wire não foi chamado")
    return _firebird_connection()


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


def _giro_fragment_sql() -> str:
    """Sem cache: alterações em estoque_giro_fragment.sql passam a valer após reload do processo."""
    return _load_sql("estoque_giro_fragment.sql")


def _bcg_fragment_sql() -> str:
    """Sem cache: alterações em estoque_bcg_fragment.sql refletem sem depender de LRU."""
    return _load_sql("estoque_bcg_fragment.sql")


_GIRO_STATUS = frozenset({"EXCESSO", "SEM GIRO", "CRITICO", "ALERTA", "ESTAVEL"})
_GIRO_CATEGORIA = frozenset(
    {
        "Produtos para Promocao",
        "Produtos para Reposicao",
        "Produtos Parados",
        "Estavel",
    }
)
_GIRO_FAIXA_MARGEM = frozenset(
    {"< 20%", "20% - 40%", "40% - 60%", ">= 60%", "SEM VENDA"}
)
_GIRO_SALDO = frozenset({"NEGATIVO", "ZERO", "POSITIVO"})
_BCG_CLASSE = frozenset({"ESTRELA", "VACA LEITEIRA", "PONTO INTERROGACAO", "ABACAXI"})

# Colunas permitidas em ORDER BY (GIRO)
_GIRO_SORT_COLS: dict[str, str] = {
    "ID_IDENTIFICADOR": "G.ID_IDENTIFICADOR",
    "ITEM": "G.ITEM",
    "REFERENCIA": "G.REFERENCIA",
    "ID_GRUPO": "G.ID_GRUPO",
    "CODIGO_ITEM": "G.CODIGO_ITEM",
    "CATEGORIA": "G.CATEGORIA",
    "ID_NIVEL1": "G.ID_NIVEL1",
    "ID_NIVEL2": "G.ID_NIVEL2",
    "QUANT_ESTOQUE": "G.QUANT_ESTOQUE",
    "ESTOQUE_MINIMO_CADASTRO": "G.ESTOQUE_MINIMO_CADASTRO",
    "ESTOQUE_MEDIO": "G.ESTOQUE_MEDIO",
    "QUANT_VENDAS": "G.QUANT_VENDAS",
    "VALOR_VENDAS": "G.VALOR_VENDAS",
    "CMV_ESTIMADO": "G.CMV_ESTIMADO",
    "VALOR_ESTOQUE_ESTIMADO": "G.VALOR_ESTOQUE_ESTIMADO",
    "ULTIMA_VENDA": "G.ULTIMA_VENDA",
    "DIAS_SEM_VENDA": "G.DIAS_SEM_VENDA",
    "VENDA_DIA_MEDIA": "G.VENDA_DIA_MEDIA",
    "ESTOQUE_EM_DIAS": "G.ESTOQUE_EM_DIAS",
    "ESTOQUE_IDEAL": "G.ESTOQUE_IDEAL",
    "STATUS_COBERTURA": "G.STATUS_COBERTURA",
    "CATEGORIA_ACAO": "G.CATEGORIA_ACAO",
    "SUGESTAO_COMPRA_QTD": "G.SUGESTAO_COMPRA_QTD",
    "MARGEM_BRUTA_PCT": "G.MARGEM_BRUTA_PCT",
    "MARGEM_BRUTA_RS": "G.MARGEM_BRUTA_RS",
    "MARKUP_PCT": "G.MARKUP_PCT",
    "FAIXA_MARGEM": "G.FAIXA_MARGEM",
}

_BCG_SORT_COLS: dict[str, str] = {
    "ID_IDENTIFICADOR": "B.ID_IDENTIFICADOR",
    "PRODUTO": "B.PRODUTO",
    "REFERENCIA": "B.REFERENCIA",
    "ID_CLASSIFICACAO": "B.ID_CLASSIFICACAO",
    "VALOR_ATUAL": "B.VALOR_ATUAL",
    "VALOR_ANTERIOR": "B.VALOR_ANTERIOR",
    "CUSTO_ATUAL": "B.CUSTO_ATUAL",
    "MARGEM_BRUTA_VALOR_ATUAL": "B.MARGEM_BRUTA_VALOR_ATUAL",
    "MARGEM_BRUTA_PCT_ATUAL": "B.MARGEM_BRUTA_PCT_ATUAL",
    "CRESCIMENTO_VENDAS_PCT": "B.CRESCIMENTO_VENDAS_PCT",
    "PARTICIPACAO_VENDAS_CLASSIFICACAO_PCT": "B.PARTICIPACAO_VENDAS_CLASSIFICACAO_PCT",
    "CLASSE_BCG": "B.CLASSE_BCG",
}


def _sql_str_literal(val: str) -> str:
    return "'" + val.replace("'", "''") + "'"


def _giro_where_clause(
    id_grupo: int | None,
    id_nivel1: int | None,
    id_nivel2: int | None,
    status_cobertura: str | None,
    categoria_acao: str | None,
    sugestao_gt_zero: bool,
    faixa_margem: str | None = None,
    saldo_negativo_only: bool = False,
    saldo_tipo: str | None = None,
    estoque_dias_min: float | None = None,
    estoque_dias_max: float | None = None,
) -> str:
    parts = ["1=1"]
    if id_grupo is not None:
        parts.append(f"G.ID_GRUPO = {int(id_grupo)}")
    if id_nivel1 is not None:
        parts.append(f"G.ID_NIVEL1 = {int(id_nivel1)}")
    if id_nivel2 is not None:
        parts.append(f"G.ID_NIVEL2 = {int(id_nivel2)}")
    if status_cobertura and status_cobertura in _GIRO_STATUS:
        parts.append(f"G.STATUS_COBERTURA = {_sql_str_literal(status_cobertura)}")
    if categoria_acao and categoria_acao in _GIRO_CATEGORIA:
        parts.append(f"G.CATEGORIA_ACAO = {_sql_str_literal(categoria_acao)}")
    if sugestao_gt_zero:
        parts.append("G.SUGESTAO_COMPRA_QTD > 0")
    if faixa_margem and faixa_margem in _GIRO_FAIXA_MARGEM:
        parts.append(f"G.FAIXA_MARGEM = {_sql_str_literal(faixa_margem)}")
    if saldo_negativo_only:
        parts.append("G.QUANT_ESTOQUE < 0")
    if saldo_tipo and saldo_tipo in _GIRO_SALDO:
        if saldo_tipo == "NEGATIVO":
            parts.append("G.QUANT_ESTOQUE < 0")
        elif saldo_tipo == "ZERO":
            parts.append("G.QUANT_ESTOQUE = 0")
        elif saldo_tipo == "POSITIVO":
            parts.append("G.QUANT_ESTOQUE > 0")
    if estoque_dias_min is not None:
        parts.append(f"G.ESTOQUE_EM_DIAS >= {float(estoque_dias_min)}")
    if estoque_dias_max is not None:
        parts.append(f"G.ESTOQUE_EM_DIAS <= {float(estoque_dias_max)}")
    return " AND ".join(parts)


_GIRO_ORDER = {
    "default": "G.CATEGORIA_ACAO, G.STATUS_COBERTURA, G.DIAS_SEM_VENDA DESC, G.ESTOQUE_EM_DIAS",
    "item": "G.ITEM",
    "item_desc": "G.ITEM DESC",
    "valor_estoque": "G.VALOR_ESTOQUE_ESTIMADO DESC",
    "sugestao": "G.SUGESTAO_COMPRA_QTD DESC",
    "margem": "G.MARGEM_BRUTA_PCT DESC",
    "estoque_dias": "G.ESTOQUE_EM_DIAS ASC",
    "critico_primeiro": "CASE G.STATUS_COBERTURA WHEN 'CRITICO' THEN 0 WHEN 'ALERTA' THEN 1 ELSE 2 END, G.ESTOQUE_EM_DIAS ASC",
}


def _giro_order_by(sort_key: str) -> str:
    return _GIRO_ORDER.get(sort_key, _GIRO_ORDER["default"])


def _giro_order_clause(
    sort_col: str | None, sort_dir: str | None, legacy_sort: str
) -> str:
    if sort_col and sort_col in _GIRO_SORT_COLS:
        d = "DESC" if (sort_dir or "").upper() == "DESC" else "ASC"
        return f"{_GIRO_SORT_COLS[sort_col]} {d}, G.ID_IDENTIFICADOR"
    return _giro_order_by(legacy_sort)


def _bcg_order_clause(sort_col: str | None, sort_dir: str | None) -> str:
    if sort_col and sort_col in _BCG_SORT_COLS:
        d = "DESC" if (sort_dir or "").upper() == "DESC" else "ASC"
        return f"{_BCG_SORT_COLS[sort_col]} {d}, B.ID_IDENTIFICADOR"
    return "B.VALOR_ATUAL DESC, B.PRODUTO"


def _kpis_and_charts_from_giro_resumo(r: dict) -> tuple[dict, list[dict], list[dict]]:
    def i(k: str) -> int:
        try:
            return int(r.get(k) or 0)
        except (TypeError, ValueError):
            return 0

    kpis = {
        "total_produtos": i("TOTAL_PRODUTOS"),
        "qtd_saldo_negativo": i("QTD_SALDO_NEGATIVO"),
        "produtos_promocao": i("PRODUTOS_PROMOCAO"),
        "produtos_reposicao": i("PRODUTOS_REPOSICAO"),
        "produtos_parados": i("PRODUTOS_PARADOS"),
        "estavel": i("PRODUTOS_ESTAVEL"),
        "cobertura_excesso": i("COBERTURA_EXCESSO"),
        "cobertura_critico": i("COBERTURA_CRITICO"),
        "cobertura_alerta": i("COBERTURA_ALERTA"),
        "cobertura_estavel": i("COBERTURA_ESTAVEL"),
        "cobertura_sem_giro": i("COBERTURA_SEM_GIRO"),
        "media_estoque_em_dias": float(r.get("MEDIA_ESTOQUE_EM_DIAS") or 0),
        "produtos_margem_lt_20": i("PRODUTOS_MARGEM_LT_20"),
        "produtos_com_sugestao_compra": i("PRODUTOS_COM_SUGESTAO_COMPRA"),
        "total_valor_estoque_estimado": float(r.get("TOTAL_VALOR_ESTOQUE_ESTIMADO") or 0),
        "total_valor_vendas_janela": float(r.get("TOTAL_VALOR_VENDAS_JANELA") or 0),
        "total_cmv_janela": float(r.get("TOTAL_CMV_JANELA") or 0),
        "faixa_lt20": i("FAIXA_MARGEM_LT20_COUNT"),
        "faixa_20_40": i("FAIXA_MARGEM_20_40_COUNT"),
        "faixa_40_60": i("FAIXA_MARGEM_40_60_COUNT"),
        "faixa_60_plus": i("FAIXA_MARGEM_60_PLUS_COUNT"),
        "faixa_sem_venda": i("FAIXA_SEM_VENDA_COUNT"),
    }
    chart_acao = [
        {"name": "Produtos para Promocao", "value": i("PRODUTOS_PROMOCAO")},
        {"name": "Produtos para Reposicao", "value": i("PRODUTOS_REPOSICAO")},
        {"name": "Produtos Parados", "value": i("PRODUTOS_PARADOS")},
        {"name": "Estavel", "value": i("PRODUTOS_ESTAVEL")},
    ]
    chart_status = [
        {"name": "Excesso", "value": i("COBERTURA_EXCESSO")},
        {"name": "Critico", "value": i("COBERTURA_CRITICO")},
        {"name": "Alerta", "value": i("COBERTURA_ALERTA")},
        {"name": "Estavel", "value": i("COBERTURA_ESTAVEL")},
        {"name": "Sem giro", "value": i("COBERTURA_SEM_GIRO")},
    ]
    return kpis, chart_acao, chart_status


def _bcg_where_clause(classe_bcg: str | None) -> str:
    if classe_bcg and classe_bcg in _BCG_CLASSE:
        return f" AND B.CLASSE_BCG = {_sql_str_literal(classe_bcg)}"
    return ""


@router.get("/contas-a-pagar")
def dash_contas_a_pagar():
    summary_sql = """
    SELECT
      COUNT(DISTINCT P.ID_CTAPAG) AS QTD_TITULOS,
      COUNT(DISTINCT P.ID_FORNEC) AS QTD_FORNECEDORES,
      COALESCE(SUM(
        CASE WHEN COALESCE(B.VLR_PAGO_TOTAL, 0) > 0.005 THEN 0 ELSE P.VLR_CTAPAG END
      ), 0) AS SALDO_TOTAL_ABERTO,
      COALESCE(SUM(CASE WHEN P.DT_VENCTO < CURRENT_DATE
        THEN CASE WHEN COALESCE(B.VLR_PAGO_TOTAL, 0) > 0.005 THEN 0 ELSE P.VLR_CTAPAG END
        ELSE 0 END), 0) AS SALDO_ATRASADO,
      COALESCE(SUM(CASE WHEN P.DT_VENCTO >= CURRENT_DATE
        THEN CASE WHEN COALESCE(B.VLR_PAGO_TOTAL, 0) > 0.005 THEN 0 ELSE P.VLR_CTAPAG END
        ELSE 0 END), 0) AS SALDO_A_VENCER,
      (SELECT COALESCE(
          AVG(CAST(PQ.DT_VENCTO - PQ.DT_EMISSAO AS DOUBLE PRECISION)), 0)
       FROM TB_CONTA_PAGAR PQ
       LEFT JOIN (
           SELECT ID_CTAPAG, SUM(VLR_PAGO) AS VLR_PAGO_TOTAL
           FROM TB_CTAPAG_BAIXA
           GROUP BY ID_CTAPAG
       ) BQ ON BQ.ID_CTAPAG = PQ.ID_CTAPAG
       WHERE PQ.VLR_CTAPAG > 0
         AND COALESCE(BQ.VLR_PAGO_TOTAL, 0) > 0.005
      ) AS PRAZO_MEDIO_DIAS
    FROM TB_CONTA_PAGAR P
    LEFT JOIN (
        SELECT ID_CTAPAG, SUM(VLR_PAGO) AS VLR_PAGO_TOTAL
        FROM TB_CTAPAG_BAIXA
        GROUP BY ID_CTAPAG
    ) B ON B.ID_CTAPAG = P.ID_CTAPAG
    WHERE P.VLR_CTAPAG > 0.005
      AND COALESCE(B.VLR_PAGO_TOTAL, 0) <= 0.005
    """
    sql_mes_pago = """
    SELECT
      CAST(EXTRACT(MONTH FROM BX.DT_BAIXA) AS INTEGER) AS MES_NUM,
      COALESCE(SUM(BX.VLR_PAGO), 0) AS VALOR
    FROM TB_CTAPAG_BAIXA BX
    INNER JOIN TB_CONTA_PAGAR P ON P.ID_CTAPAG = BX.ID_CTAPAG
    WHERE CAST(EXTRACT(YEAR FROM BX.DT_BAIXA) AS INTEGER)
        = CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER)
    GROUP BY 1
    ORDER BY 1
    """
    sql_mes_saldo_venc = """
    SELECT
      CAST(EXTRACT(MONTH FROM P.DT_VENCTO) AS INTEGER) AS MES_NUM,
      COALESCE(SUM(
        CASE WHEN COALESCE(B.VLR_PAGO_TOTAL, 0) > 0.005 THEN 0 ELSE P.VLR_CTAPAG END
      ), 0) AS VALOR
    FROM TB_CONTA_PAGAR P
    LEFT JOIN (
        SELECT ID_CTAPAG, SUM(VLR_PAGO) AS VLR_PAGO_TOTAL
        FROM TB_CTAPAG_BAIXA
        GROUP BY ID_CTAPAG
    ) B ON B.ID_CTAPAG = P.ID_CTAPAG
    WHERE P.VLR_CTAPAG > 0.005
      AND COALESCE(B.VLR_PAGO_TOTAL, 0) <= 0.005
      AND CAST(EXTRACT(YEAR FROM P.DT_VENCTO) AS INTEGER)
        = CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER)
    GROUP BY 1
    ORDER BY 1
    """
    try:
        kpis = _one_row(summary_sql)
        analitico = _load_sql("contas_a_pagar_analitico.sql")
        _, rows = _execute(analitico, max_rows=600)
        _, rows_mes_pago = _execute(sql_mes_pago, max_rows=None)
        _, rows_mes_aberto = _execute(sql_mes_saldo_venc, max_rows=None)
        evolucao_mes = _merge_evolucao_pagar_mes(rows_mes_pago, rows_mes_aberto)
        sql_matriz = _load_sql("contas_pagar_matriz_hierarquia.sql")
        _, rows_matriz = _execute(sql_matriz, max_rows=2500)
        by_f: dict[str, float] = {}
        for r in rows:
            nome = str(r.get("FORNECEDOR") or "").strip() or "—"
            saldo = float(r.get("SALDO_ABERTO") or 0)
            by_f[nome] = by_f.get(nome, 0.0) + saldo
        top_forn = sorted(by_f.items(), key=lambda x: -x[1])[:12]
        chart_forn = [{"name": a[:35], "valor": round(b, 2)} for a, b in top_forn]
        return {
            "kpis": kpis,
            "rows": rows,
            "chart_top_fornecedores": chart_forn,
            "evolucao_mes": evolucao_mes,
            "ano_evolucao_mensal": date.today().year,
            "matriz_hierarquia": rows_matriz,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _contas_receber_where_aberto() -> str:
    """Títulos em aberto. Sufixo _2 só com CONSTRUNEVES_RECEBER_TABELA_SUFFIX=_2 no .env."""
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
    w = _contas_receber_where_aberto() + _receber_nf_mt("R.ID_CLIENTE")
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
        kpis = _one_row(_receber_sql(summary_sql))
        aging = _one_row(_receber_sql(aging_sql))
        chart_atraso = [
            {"name": "A vencer", "valor": round(float(aging.get("B_A_VENCER") or 0), 2)},
            {"name": "1 a 7 dias", "valor": round(float(aging.get("B_1_7") or 0), 2)},
            {"name": "8 a 15 dias", "valor": round(float(aging.get("B_8_15") or 0), 2)},
            {"name": "16 a 30 dias", "valor": round(float(aging.get("B_16_30") or 0), 2)},
            {"name": "31 a 60 dias", "valor": round(float(aging.get("B_31_60") or 0), 2)},
            {"name": "61 a 90 dias", "valor": round(float(aging.get("B_61_90") or 0), 2)},
            {"name": "Acima de 90 dias", "valor": round(float(aging.get("B_ACIMA_90") or 0), 2)},
        ]
        por_cliente = _receber_sql(
            _receber_nf_mt_filter(_load_sql("contas_a_receber_por_cliente.sql")),
        )
        _, rows_pc = _execute(por_cliente, max_rows=None)
        _, mes_vendas = _execute(_receber_sql(sql_mes_vendas), max_rows=None)
        _, mes_recebidos = _execute(_receber_sql(sql_mes_recebidos), max_rows=None)
        _, mes_pendentes = _execute(_receber_sql(sql_mes_pendentes), max_rows=None)
        _, rows_v30 = _execute(_receber_sql(sql_ind_v30_mes), max_rows=None)
        _, rows_pmr_baixa = _execute(_receber_sql(sql_pmr_emissao_baixa_mes), max_rows=None)
        analitico = _receber_sql(
            _receber_nf_mt_filter(_load_sql("contas_receber_analitico_prazo_medio.sql")),
        )
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


def _dash_estoque_giro_resumo_payload() -> dict:
    frag = _giro_fragment_sql()
    sql = frag + "\n" + _load_sql("estoque_giro_resumo.sql")
    row = _one_row(sql)
    kpis, chart_acao, chart_status = _kpis_and_charts_from_giro_resumo(row)
    margem_bruta_media_pct = 0.0
    tv = kpis["total_valor_vendas_janela"]
    tc = kpis["total_cmv_janela"]
    if tv and tv > 0:
        margem_bruta_media_pct = round((tv - tc) / tv * 100.0, 2)
    kpis["margem_bruta_media_pct"] = margem_bruta_media_pct
    chart_faixa_margem = [
        {"name": "< 20%", "value": kpis["faixa_lt20"]},
        {"name": "20% - 40%", "value": kpis["faixa_20_40"]},
        {"name": "40% - 60%", "value": kpis["faixa_40_60"]},
        {"name": ">= 60%", "value": kpis["faixa_60_plus"]},
        {"name": "Sem venda", "value": kpis["faixa_sem_venda"]},
    ]
    return {
        "kpis": kpis,
        "chart_categoria_acao": chart_acao,
        "chart_status_cobertura": chart_status,
        "chart_faixa_margem": chart_faixa_margem,
    }


@router.get("/estoque/giro-resumo")
def dash_estoque_giro_resumo():
    try:
        return _dash_estoque_giro_resumo_payload()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/estoque/giro-filtros")
def dash_estoque_giro_filtros():
    try:
        sql = _giro_fragment_sql() + "\n" + _load_sql("estoque_giro_filtros.sql")
        _, rows = _execute(sql, max_rows=None)
        return {"rows": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/estoque/pedidos-compra")
def dash_estoque_pedidos_compra():
    """Itens de pedido de compra (ordens não finalizadas nem canceladas)."""
    try:
        _, rows = _execute(_load_sql("ped_compra_aberto_lista.sql"), max_rows=None)
        k = _one_row(_load_sql("ped_compra_aberto_kpis.sql"))
        n_lin = int(k.get("QTD_ITENS") or 0)
        n_ord = int(k.get("QTD_ORDENS") or 0)
        return {
            "count": n_lin,
            "ordens_abertas": n_ord,
            "rows": rows,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/estoque/pedidos-compra/item")
def dash_estoque_pedidos_compra_delete(
    id_ped_compra_ordem: int = Query(..., ge=1),
    id_identificador: int = Query(..., ge=1),
):
    """Exclui uma linha da ordem de compra aberta (tb_ped_compra_ordem_item)."""
    with firebird_conn_context() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                DELETE FROM TB_PED_COMPRA_ORDEM_ITEM
                WHERE ID_PED_COMPRA_ORDEM = ? AND ID_IDENTIFICADOR = ?
                """,
                (id_ped_compra_ordem, id_identificador),
            )
            affected = int(cur.rowcount or 0)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=502, detail=str(e)) from e
        finally:
            cur.close()
    if affected <= 0:
        raise HTTPException(status_code=404, detail="Item não encontrado na ordem informada.")
    return {
        "ok": True,
        "deleted": 1,
        "id_ped_compra_ordem": id_ped_compra_ordem,
        "id_identificador": id_identificador,
    }


def _fetch_giro_itens(
    page: int = 1,
    page_size: int = 25,
    id_grupo: int | None = None,
    id_nivel1: int | None = None,
    id_nivel2: int | None = None,
    status_cobertura: str | None = None,
    categoria_acao: str | None = None,
    sugestao_gt_zero: bool = False,
    sort: str = "default",
    sort_col: str | None = None,
    sort_dir: str | None = None,
    faixa_margem: str | None = None,
    saldo_negativo_only: bool = False,
    saldo_tipo: str | None = None,
    estoque_dias_min: float | None = None,
    estoque_dias_max: float | None = None,
) -> dict:
    frag = _giro_fragment_sql()
    w = _giro_where_clause(
        id_grupo,
        id_nivel1,
        id_nivel2,
        status_cobertura,
        categoria_acao,
        sugestao_gt_zero,
        faixa_margem=faixa_margem,
        saldo_negativo_only=saldo_negativo_only,
        saldo_tipo=saldo_tipo,
        estoque_dias_min=estoque_dias_min,
        estoque_dias_max=estoque_dias_max,
    )
    order = _giro_order_clause(sort_col, sort_dir, sort)
    sql_cnt = frag + f"\nSELECT COUNT(*) AS CNT FROM GIRO G WHERE {w}"
    cnt_row = _one_row(sql_cnt)
    total = int(cnt_row.get("CNT") or 0)
    skip = (page - 1) * page_size
    sql_rows = (
        frag
        + f"\nSELECT FIRST {int(page_size)} SKIP {int(skip)} * FROM GIRO G WHERE {w} ORDER BY {order}"
    )
    _, rows = _execute(sql_rows, max_rows=None)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": rows,
    }


@router.get("/estoque/giro-itens")
def dash_estoque_giro_itens(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    id_grupo: int | None = None,
    id_nivel1: int | None = None,
    id_nivel2: int | None = None,
    status_cobertura: str | None = None,
    categoria_acao: str | None = None,
    sugestao_gt_zero: bool = False,
    sort: str = "default",
    sort_col: str | None = None,
    sort_dir: str | None = None,
    faixa_margem: str | None = None,
    saldo_negativo_only: bool = False,
    saldo_tipo: str | None = None,
    estoque_dias_min: float | None = Query(None, ge=0),
    estoque_dias_max: float | None = Query(None, ge=0),
):
    try:
        sd = (sort_dir or "").upper() if sort_dir else None
        if sd and sd not in ("ASC", "DESC"):
            sd = None
        return _fetch_giro_itens(
            page=page,
            page_size=page_size,
            id_grupo=id_grupo,
            id_nivel1=id_nivel1,
            id_nivel2=id_nivel2,
            status_cobertura=status_cobertura,
            categoria_acao=categoria_acao,
            sugestao_gt_zero=sugestao_gt_zero,
            sort=sort,
            sort_col=sort_col,
            sort_dir=sd,
            faixa_margem=faixa_margem,
            saldo_negativo_only=saldo_negativo_only,
            saldo_tipo=(saldo_tipo or "").upper() or None,
            estoque_dias_min=estoque_dias_min,
            estoque_dias_max=estoque_dias_max,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/estoque/giro")
def dash_estoque_giro():
    """Legado: mesmo resumo que giro-resumo + primeira página de itens (50 linhas)."""
    try:
        payload = _dash_estoque_giro_resumo_payload()
        page_data = _fetch_giro_itens(page=1, page_size=50)
        return {
            **payload,
            "rows": page_data["rows"],
            "legacy_note": "Use /dash/estoque/giro-resumo e /dash/estoque/giro-itens para dados completos.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _dash_estoque_bcg_resumo_payload() -> dict:
    frag = _bcg_fragment_sql()
    sql = frag + "\n" + _load_sql("estoque_bcg_resumo.sql")
    row = _one_row(sql)

    def i(k: str) -> int:
        try:
            return int(row.get(k) or 0)
        except (TypeError, ValueError):
            return 0

    kpis = {
        "total_produtos": i("TOTAL_PRODUTOS"),
        "qtd_estrela": i("QTD_ESTRELA"),
        "qtd_vaca": i("QTD_VACA"),
        "qtd_ponto": i("QTD_PONTO"),
        "qtd_abacaxi": i("QTD_ABACAXI"),
        "soma_valor_atual": float(row.get("SOMA_VALOR_ATUAL") or 0),
    }
    chart_quad = [
        {"name": "ESTRELA", "value": i("QTD_ESTRELA")},
        {"name": "VACA LEITEIRA", "value": i("QTD_VACA")},
        {"name": "PONTO INTERROGACAO", "value": i("QTD_PONTO")},
        {"name": "ABACAXI", "value": i("QTD_ABACAXI")},
    ]
    return {"kpis": kpis, "chart_quadrantes": chart_quad}


@router.get("/estoque/bcg-resumo")
def dash_estoque_bcg_resumo():
    try:
        return _dash_estoque_bcg_resumo_payload()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _fetch_bcg_itens(
    page: int = 1,
    page_size: int = 25,
    classe_bcg: str | None = None,
    sort_col: str | None = None,
    sort_dir: str | None = None,
) -> dict:
    frag = _bcg_fragment_sql()
    extra = _bcg_where_clause(classe_bcg)
    order = _bcg_order_clause(sort_col, sort_dir)
    sql_cnt = frag + f"\nSELECT COUNT(*) AS CNT FROM BCG_ROWS B WHERE 1=1{extra}"
    cnt_row = _one_row(sql_cnt)
    total = int(cnt_row.get("CNT") or 0)
    skip = (page - 1) * page_size
    sql_rows = (
        frag
        + f"\nSELECT FIRST {int(page_size)} SKIP {int(skip)} * FROM BCG_ROWS B WHERE 1=1{extra} ORDER BY {order}"
    )
    _, rows = _execute(sql_rows, max_rows=None)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": rows,
    }


@router.get("/estoque/bcg-itens")
def dash_estoque_bcg_itens(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    classe_bcg: str | None = None,
    sort_col: str | None = None,
    sort_dir: str | None = None,
):
    try:
        sd = (sort_dir or "").upper() if sort_dir else None
        if sd and sd not in ("ASC", "DESC"):
            sd = None
        return _fetch_bcg_itens(
            page=page,
            page_size=page_size,
            classe_bcg=classe_bcg,
            sort_col=sort_col,
            sort_dir=sd,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/estoque/bcg")
def dash_estoque_bcg():
    """Resumo global + primeira página (compatível com hub paginado)."""
    try:
        payload = _dash_estoque_bcg_resumo_payload()
        page1 = _fetch_bcg_itens(page=1, page_size=50)
        return {**payload, "rows": page1["rows"]}
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


# --- Vendas (NF saída finalizada, TB_NFVENDA_2 / TB_NFV_ITEM_2) ---

_VENDAS_PROD_SORT: dict[str, str] = {
    "PRODUTO": "PA.PRODUTO",
    "REFERENCIA": "PA.REFERENCIA",
    "ID_ESTOQUE": "PA.ID_ESTOQUE",
    "CONTAGEM_NF": "PA.CONTAGEM_NF",
    "QUANTIDADE": "PA.QUANTIDADE",
    "VALOR_ITENS": "PA.VALOR_ITENS",
    "DESCONTO": "PA.DESCONTO",
    "TOTAL_LIQUIDO": "PA.TOTAL_LIQUIDO",
    "CMV": "PA.CMV",
    "MARGEM_BRUTA_RS": "PA.MARGEM_BRUTA_RS",
}


def _vendas_mes_clause(mes: int | None) -> str:
    if mes is None:
        return ""
    m = int(mes)
    if not (1 <= m <= 12):
        return ""
    return f" AND CAST(EXTRACT(MONTH FROM N.DT_SAIDA) AS INTEGER) = {m}"


def _vendas_linhas_cte_sql(ano: int, mes: int | None = None) -> str:
    return (
        _load_sql("vendas_linhas_cte.sql")
        .replace("__ANO__", str(int(ano)))
        .replace("__MES_SQL__", _vendas_mes_clause(mes))
    )


def _vendas_forma_sql(ano: int, mes: int | None = None) -> str:
    return (
        _load_sql("vendas_forma_pagamento.sql")
        .replace("__ANO__", str(int(ano)))
        .replace("__MES_SQL__", _vendas_mes_clause(mes))
    )


def _abc_classify_produtos(rows: list[dict], metric_key: str) -> list[dict]:
    """Curva ABC 80/15/5: classe pelo % acumulado antes de incluir o item (ordenado desc)."""
    out: list[dict] = []
    for r in rows:
        d = dict(r)
        out.append(d)
    for r in out:
        r["_met"] = float(r.get(metric_key) or 0)
    out.sort(key=lambda x: x["_met"], reverse=True)
    total = sum(x["_met"] for x in out)
    cum_before = 0.0
    for r in out:
        v = r["_met"]
        pct_before = (cum_before / total * 100.0) if total > 0 else 0.0
        if pct_before < 80.0:
            cls = "A"
        elif pct_before < 95.0:
            cls = "B"
        else:
            cls = "C"
        cum_before += v
        pct_acum = (cum_before / total * 100.0) if total > 0 else 0.0
        r["CLASSE_ABC"] = cls
        r["PCT_DO_TOTAL"] = round((v / total * 100.0), 4) if total > 0 else 0.0
        r["PCT_ACUMULADO"] = round(pct_acum, 4)
        del r["_met"]
    return out


def _vendas_produto_agg_sql(cte: str) -> str:
    return (
        cte
        + """,
PRODUTO_AGG AS (
    SELECT
        L.ID_ESTOQUE,
        L.PRODUTO,
        L.REFERENCIA,
        L.ID_GRUPO,
        COUNT(DISTINCT L.ID_NFVENDA) AS CONTAGEM_NF,
        COALESCE(SUM(L.QTD_ITEM), 0) AS QUANTIDADE,
        COALESCE(SUM(L.VLR_TOTAL), 0) AS VALOR_ITENS,
        COALESCE(SUM(L.VLR_DESC), 0) AS DESCONTO,
        COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO,
        COALESCE(SUM(L.VLR_CUSTO), 0) AS CMV,
        COALESCE(SUM(L.MARGEM_BRUTA_LINHA), 0) AS MARGEM_BRUTA_RS
    FROM VENDAS_LINHAS L
    GROUP BY L.ID_ESTOQUE, L.PRODUTO, L.REFERENCIA, L.ID_GRUPO
)
"""
    )


def _fetch_vendas_por_produto(
    ano: int,
    mes: int | None,
    page: int,
    page_size: int,
    sort_col: str | None,
    sort_dir: str | None,
) -> dict[str, Any]:
    cte = _vendas_linhas_cte_sql(ano, mes)
    base = _vendas_produto_agg_sql(cte)
    sql_cnt = base + "SELECT COUNT(*) AS CNT FROM PRODUTO_AGG"
    total = int(_one_row(sql_cnt).get("CNT") or 0)
    col = (sort_col or "").strip().upper()
    if col not in _VENDAS_PROD_SORT:
        col = "TOTAL_LIQUIDO"
    order_col = _VENDAS_PROD_SORT[col]
    sd = (sort_dir or "DESC").upper()
    if sd not in ("ASC", "DESC"):
        sd = "DESC"
    skip = (page - 1) * page_size
    sql_rows = (
        base
        + f"SELECT FIRST {int(page_size)} SKIP {int(skip)} "
        + f"PA.* FROM PRODUTO_AGG PA ORDER BY {order_col} {sd}, PA.PRODUTO"
    )
    _, rows = _execute(sql_rows, max_rows=None)
    for r in rows:
        tl = float(r.get("TOTAL_LIQUIDO") or 0)
        mg = float(r.get("MARGEM_BRUTA_RS") or 0)
        r["MARGEM_BRUTA_PCT"] = round((mg / tl * 100.0), 2) if tl > 0 else 0.0
    return {"total": total, "page": page, "page_size": page_size, "rows": rows}


def _dash_vendas_resumo_payload(ano: int, mes: int | None) -> dict[str, Any]:
    cte = _vendas_linhas_cte_sql(ano, mes)
    sql_kpi = (
        cte
        + """
SELECT
    (SELECT COALESCE(SUM(NF.NF_DESCONTO), 0) FROM VENDAS_NF NF) AS DESCONTO_NF_CABECALHO,
    COUNT(DISTINCT L.ID_NFVENDA) AS QTD_NF,
    COUNT(*) AS QTD_LINHAS_ITENS,
    COALESCE(SUM(L.QTD_ITEM), 0) AS QUANTIDADE,
    COALESCE(SUM(L.VLR_TOTAL), 0) AS VALOR_ITENS,
    COALESCE(SUM(L.VLR_DESC), 0) AS DESCONTO_ITENS,
    COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO,
    COALESCE(SUM(L.VLR_CUSTO), 0) AS CMV,
    COALESCE(SUM(L.MARGEM_BRUTA_LINHA), 0) AS MARGEM_BRUTA_RS
FROM VENDAS_LINHAS L
"""
    )
    k = _one_row(sql_kpi)
    qnf = float(k.get("QTD_NF") or 0)
    ticket = round(float(k.get("TOTAL_LIQUIDO") or 0) / qnf, 2) if qnf else 0.0
    tl = float(k.get("TOTAL_LIQUIDO") or 0)
    mg = float(k.get("MARGEM_BRUTA_RS") or 0)
    k["TICKET_MEDIO_NF"] = ticket
    k["MARGEM_BRUTA_PCT"] = round((mg / tl * 100.0), 2) if tl > 0 else 0.0

    sql_serie = (
        cte
        + """
SELECT
    L.ANO,
    L.MES_NUM,
    COUNT(DISTINCT L.ID_NFVENDA) AS QTD_NF,
    COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO,
    COALESCE(SUM(L.MARGEM_BRUTA_LINHA), 0) AS MARGEM_BRUTA_RS
FROM VENDAS_LINHAS L
GROUP BY L.ANO, L.MES_NUM
ORDER BY L.ANO, L.MES_NUM
"""
    )
    _, serie = _execute(sql_serie, max_rows=None)

    sql_top = (
        cte
        + """
SELECT FIRST 15
    L.ID_CLIENTE,
    TRIM(COALESCE(C.NOME, '(sem nome)')) AS NOME_CLIENTE,
    COUNT(DISTINCT L.ID_NFVENDA) AS QTD_NF,
    COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO,
    COALESCE(SUM(L.MARGEM_BRUTA_LINHA), 0) AS MARGEM_BRUTA_RS
FROM VENDAS_LINHAS L
LEFT JOIN TB_CLIENTE C ON C.ID_CLIENTE = L.ID_CLIENTE
WHERE L.ID_CLIENTE IS NOT NULL
GROUP BY L.ID_CLIENTE, C.NOME
ORDER BY COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) DESC
"""
    )
    _, top_clientes = _execute(sql_top, max_rows=None)

    sql_grupo = (
        cte
        + """
SELECT
    L.ID_GRUPO,
    COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO
FROM VENDAS_LINHAS L
GROUP BY L.ID_GRUPO
ORDER BY 2 DESC
"""
    )
    _, mix_grupo = _execute(sql_grupo, max_rows=30)

    return {
        "ano": ano,
        "mes": mes,
        "kpis": k,
        "serie_mensal": serie,
        "top_clientes": top_clientes,
        "mix_grupo": mix_grupo,
    }


def _dash_vendas_periodo_vendedor(ano: int, mes: int | None) -> list[dict]:
    cte = _vendas_linhas_cte_sql(ano, mes)
    sql = (
        cte
        + """
SELECT
    L.ANO,
    L.MES_NUM,
    L.ID_VENDEDOR,
    L.NOME_VENDEDOR,
    COUNT(DISTINCT L.ID_NFVENDA) AS CONTAGEM_NF,
    COALESCE(SUM(L.QTD_ITEM), 0) AS QUANTIDADE,
    COALESCE(SUM(L.VLR_TOTAL), 0) AS VALOR_ITENS,
    COALESCE(SUM(L.VLR_DESC), 0) AS DESCONTO,
    COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO,
    COALESCE(SUM(L.MARGEM_BRUTA_LINHA), 0) AS MARGEM_BRUTA_RS
FROM VENDAS_LINHAS L
GROUP BY L.ANO, L.MES_NUM, L.ID_VENDEDOR, L.NOME_VENDEDOR
ORDER BY L.ANO DESC, L.MES_NUM, L.NOME_VENDEDOR
"""
    )
    _, rows = _execute(sql, max_rows=None)
    return rows


def _dash_vendas_periodo_produto(ano: int, mes: int | None) -> list[dict]:
    cte = _vendas_linhas_cte_sql(ano, mes)
    sql = (
        cte
        + """
SELECT
    L.ANO,
    L.MES_NUM,
    L.ID_ESTOQUE,
    L.PRODUTO,
    L.REFERENCIA,
    COUNT(DISTINCT L.ID_NFVENDA) AS CONTAGEM_NF,
    COALESCE(SUM(L.QTD_ITEM), 0) AS QUANTIDADE,
    COALESCE(SUM(L.VLR_TOTAL), 0) AS VALOR_ITENS,
    COALESCE(SUM(L.VLR_DESC), 0) AS DESCONTO,
    COALESCE(SUM(L.TOTAL_LIQUIDO_LINHA), 0) AS TOTAL_LIQUIDO,
    COALESCE(SUM(L.MARGEM_BRUTA_LINHA), 0) AS MARGEM_BRUTA_RS
FROM VENDAS_LINHAS L
GROUP BY L.ANO, L.MES_NUM, L.ID_ESTOQUE, L.PRODUTO, L.REFERENCIA
ORDER BY L.ANO DESC, L.MES_NUM, 10 DESC
"""
    )
    _, rows = _execute(sql, max_rows=None)
    return rows


def _dash_vendas_produto_agg_all(ano: int, mes: int | None) -> list[dict]:
    cte = _vendas_linhas_cte_sql(ano, mes)
    base = _vendas_produto_agg_sql(cte)
    sql = base + "SELECT PA.* FROM PRODUTO_AGG PA ORDER BY PA.TOTAL_LIQUIDO DESC"
    _, rows = _execute(sql, max_rows=8000)
    for r in rows:
        tl = float(r.get("TOTAL_LIQUIDO") or 0)
        mg = float(r.get("MARGEM_BRUTA_RS") or 0)
        r["MARGEM_BRUTA_PCT"] = round((mg / tl * 100.0), 2) if tl > 0 else 0.0
    return rows


def _vendas_parse_mes(mes: int | None) -> int | None:
    if mes is None:
        return None
    m = int(mes)
    if not (1 <= m <= 12):
        raise HTTPException(status_code=422, detail="mes deve estar entre 1 e 12")
    return m


@router.get("/vendas/resumo")
def dash_vendas_resumo(
    ano: int | None = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    try:
        y = int(ano) if ano is not None else date.today().year
        return _dash_vendas_resumo_payload(y, _vendas_parse_mes(mes))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/vendas/por-produto")
def dash_vendas_por_produto(
    ano: int | None = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort_col: str | None = None,
    sort_dir: str | None = None,
):
    try:
        y = int(ano) if ano is not None else date.today().year
        sd = (sort_dir or "").upper() if sort_dir else None
        if sd and sd not in ("ASC", "DESC"):
            sd = None
        return _fetch_vendas_por_produto(
            y, _vendas_parse_mes(mes), page, page_size, sort_col, sd
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/vendas/abc")
def dash_vendas_abc(
    base: Annotated[str, Query(description="valor | margem")] = "valor",
    ano: int | None = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    try:
        y = int(ano) if ano is not None else date.today().year
        rows = _dash_vendas_produto_agg_all(y, _vendas_parse_mes(mes))
        b = (base or "valor").lower().strip()
        key = "MARGEM_BRUTA_RS" if b == "margem" else "TOTAL_LIQUIDO"
        classified = _abc_classify_produtos(rows, key)
        return {"base": b, "metric": key, "rows": classified}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/vendas/por-forma-pagamento")
def dash_vendas_por_forma_pagamento(
    ano: int | None = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    try:
        y = int(ano) if ano is not None else date.today().year
        sql = _vendas_forma_sql(y, _vendas_parse_mes(mes))
        _, rows = _execute(sql, max_rows=None)
        grand = sum(float(r.get("TOTAL_PAGTO") or 0) for r in rows)
        for r in rows:
            v = float(r.get("TOTAL_PAGTO") or 0)
            r["PCT_DO_TOTAL"] = round((v / grand * 100.0), 2) if grand > 0 else 0.0
        return {"rows": rows, "total_pagto": round(grand, 2)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/vendas/por-periodo-vendedor")
def dash_vendas_por_periodo_vendedor(
    ano: int | None = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    try:
        y = int(ano) if ano is not None else date.today().year
        return {"rows": _dash_vendas_periodo_vendedor(y, _vendas_parse_mes(mes))}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/vendas/por-periodo-produto")
def dash_vendas_por_periodo_produto(
    ano: int | None = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    try:
        y = int(ano) if ano is not None else date.today().year
        return {"rows": _dash_vendas_periodo_produto(y, _vendas_parse_mes(mes))}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _contas_bancarias_saldos_payload(incluir_inativas: bool) -> dict[str, Any]:
    base = _load_sql("contas_bancarias_saldos_hoje.sql")
    filt = "" if incluir_inativas else "WHERE TRIM(C.STATUS) = 'A'"
    sql = f"{base}\n{filt}\nORDER BY TRIM(C.DESCRICAO)"
    _, rows = _execute(sql, max_rows=None)
    # Regra de negócio: desconsiderar contas específicas do cadastro.
    rows = [
        r
        for r in rows
        if int(r.get("ID_CONTA") or 0) not in _CONTAS_BANCARIAS_IGNORAR
    ]
    id_sip = _ID_CONTA_SIPAG_CARTOES
    rows_bancos = [r for r in rows if int(r.get("ID_CONTA") or 0) != id_sip]
    rows_cartoes = [r for r in rows if int(r.get("ID_CONTA") or 0) == id_sip]
    ref = date.today().isoformat()

    def _totais(rs: list) -> dict[str, Any]:
        t_disp = sum(float(x.get("SALDO_DISPONIVEL") or 0) for x in rs)
        t_tal = sum(float(x.get("SALDO_TALAO_CONTABIL") or 0) for x in rs)
        t_conc = sum(float(x.get("SALDO_CONCILIADO") or 0) for x in rs)
        return {
            "qtd_contas": len(rs),
            "saldo_disponivel": round(t_disp, 2),
            "saldo_talao_contabil": round(t_tal, 2),
            "saldo_conciliado": round(t_conc, 2),
        }

    return {
        "data_referencia": ref,
        "incluir_inativas": incluir_inativas,
        "totais": _totais(rows_bancos),
        "rows": rows_bancos,
        "cartoes_receber": {
            "totais": _totais(rows_cartoes),
            "rows": rows_cartoes,
        },
    }


@router.get("/financeiro/contas-bancarias/saldos")
def dash_contas_bancarias_saldos(
    incluir_inativas: bool = Query(False, description="Incluir contas com STATUS diferente de A"),
):
    """Saldos por conta na data de hoje (campos SD_REAL e SD_BANCO do cadastro CLIPP)."""
    try:
        return _contas_bancarias_saldos_payload(incluir_inativas)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# Bases muito abaixo de 1 R$ produzem variações % com pouco significado (ruído).
_PCT_MOM_MIN_BASE_BRL = 1.0


def _pct_mom(current: float, previous: float) -> float | None:
    """% var. (atual - anterior) / |anterior| vs período homólogo, valores ≥ 0 (baixas, notas)."""
    if abs(previous) < _PCT_MOM_MIN_BASE_BRL:
        return None
    return round(((current - previous) / previous) * 100.0, 2)


def _pct_mom_fluxo(current: float, previous: float) -> float | None:
    """
    % homóloga do fluxo (recebimentos − pagamentos). Com o mesmo sinal no atual e
    no mês passado, usa (atual−anterior)/anterior. Se os sinais forem opostos
    (ex. mês passado com saída líquida e mês atual com entrada), usa
    (atual−anterior)/|anterior| para a % não ficar com denominador negativo
    inútil.
    """
    if abs(previous) < _PCT_MOM_MIN_BASE_BRL:
        return None
    if current * previous < 0:
        return round((current - previous) / abs(previous) * 100.0, 2)
    return round(((current - previous) / previous) * 100.0, 2)


def _float_metric(row: dict, key: str) -> float:
    v = row.get(key)
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _row_keys_upper(row: dict) -> dict:
    return {
        (k.strip().upper() if isinstance(k, str) else k): v for k, v in row.items()
    }


def _dash_resumo_diario_payload() -> dict[str, Any]:
    row = _row_keys_upper(_one_row(_receber_sql(_load_sql("resumo_diario.sql"))))
    saldo_payload = _contas_bancarias_saldos_payload(False)
    tot = saldo_payload["totais"]
    crb = saldo_payload.get("cartoes_receber") or {}
    tcr = crb.get("totais") or {}
    disponivel = float(tot.get("saldo_disponivel") or 0)
    qtd_contas = int(tot.get("qtd_contas") or 0)
    cr_disp = float(tcr.get("saldo_disponivel") or 0)
    cr_qtd = int(tcr.get("qtd_contas") or 0)
    ref = str(saldo_payload.get("data_referencia") or date.today().isoformat())

    ph = _float_metric(row, "PAGAR_HOJE")
    pm = _float_metric(row, "PAGAR_MTD")
    pha = _float_metric(row, "PAGAR_DIA_MES_ANT")
    pma = _float_metric(row, "PAGAR_MTD_MES_ANT")
    p_mes_cal = _float_metric(row, "PAGAR_MES_CAL")

    rh = _float_metric(row, "RECEBER_HOJE")
    rm = _float_metric(row, "RECEBER_MTD")
    rha = _float_metric(row, "RECEBER_DIA_MES_ANT")
    rma = _float_metric(row, "RECEBER_MTD_MES_ANT")
    r_mes_cal = _float_metric(row, "RECEBER_MES_CAL")

    vh = _float_metric(row, "VENDAS_HOJE")
    vm = _float_metric(row, "VENDAS_MTD")
    vha = _float_metric(row, "VENDAS_DIA_MES_ANT")
    vma = _float_metric(row, "VENDAS_MTD_MES_ANT")
    v_mes_cal = _float_metric(row, "VENDAS_MES_CAL")

    fluxo_dia = rh - ph
    fluxo_mtd = rm - pm
    fluxo_dia_ant = rha - pha
    fluxo_mtd_ant = rma - pma

    return {
        "data_referencia": ref,
        "saldo_bancario": {
            "disponivel": round(disponivel, 2),
            "qtd_contas": qtd_contas,
            "cartoes_receber": {
                "disponivel": round(cr_disp, 2),
                "qtd_contas": cr_qtd,
            },
            "pct_mom": None,
        },
        "contas_pagar_baixas": {
            "hoje": round(ph, 2),
            "mtd": round(pm, 2),
            "mes_calendario": round(p_mes_cal, 2),
            "hoje_mes_passado": round(pha, 2),
            "mtd_mes_passado": round(pma, 2),
            # Comparativo "calendário CLIPP": % e ref. vs MTD homólogo (1.º → mesma data, mês passado)
            "mes_calendario_mes_passado": round(pma, 2),
            "pct_mom_hoje": _pct_mom(ph, pha),
            "pct_mom_mtd": _pct_mom(pm, pma),
            "pct_mom_mes_calendario": _pct_mom(p_mes_cal, pma),
        },
        "contas_receber_baixas": {
            "hoje": round(rh, 2),
            "mtd": round(rm, 2),
            "mes_calendario": round(r_mes_cal, 2),
            "hoje_mes_passado": round(rha, 2),
            "mtd_mes_passado": round(rma, 2),
            "mes_calendario_mes_passado": round(rma, 2),
            "pct_mom_hoje": _pct_mom(rh, rha),
            "pct_mom_mtd": _pct_mom(rm, rma),
            "pct_mom_mes_calendario": _pct_mom(r_mes_cal, rma),
        },
        "vendas_liquido": {
            "hoje": round(vh, 2),
            "mtd": round(vm, 2),
            "mes_calendario": round(v_mes_cal, 2),
            "hoje_mes_passado": round(vha, 2),
            "mtd_mes_passado": round(vma, 2),
            "mes_calendario_mes_passado": round(vma, 2),
            "pct_mom_hoje": _pct_mom(vh, vha),
            "pct_mom_mtd": _pct_mom(vm, vma),
            "pct_mom_mes_calendario": _pct_mom(v_mes_cal, vma),
        },
        "totais_fluxo": {
            "formula": "O que entrou (recebimentos) menos o que saiu (pagamentos), alinhado aos blocos de cima.",
            "hoje": round(fluxo_dia, 2),
            "mtd": round(fluxo_mtd, 2),
            "hoje_mes_passado": round(fluxo_dia_ant, 2),
            "mtd_mes_passado": round(fluxo_mtd_ant, 2),
            "pct_mom_hoje": _pct_mom_fluxo(fluxo_dia, fluxo_dia_ant),
            "pct_mom_mtd": _pct_mom_fluxo(fluxo_mtd, fluxo_mtd_ant),
        },
    }


# --- Reconciliação MT (tabelas com sufixo _2) x CLIPP (tabelas sem sufixo) — NF compra / NF venda ---

LIMIAR_MEIA_NOTA_PCT = 0.10
LIMIAR_MEIA_NOTA_VLR = 1.0
# Valor no CLIPP muito abaixo do MT, com estoque: possível faturamento só no MT
LIMIAR_MT_SEM_CLIPP_FRAC = 0.02


def _mes_para_intervalo(ano: int, mes: int) -> tuple[date, date]:
    if not (1 <= int(mes) <= 12):
        raise ValueError("mes 1-12")
    a = int(ano)
    m = int(mes)
    d0 = date(a, m, 1)
    d1 = date(a, m, calendar.monthrange(a, m)[1])
    return d0, d1


def _reconcil_sql_mes(arq: str, d0: date, d1: date) -> str:
    s = _load_sql(arq)
    s = s.replace("__DATA_INI__", f"'{d0.isoformat()}'")
    s = s.replace("__DATA_FIM__", f"'{d1.isoformat()}'")
    return s


def _situacao_reconcil(vlr_mt: float, vlr_clipp: float) -> str:
    if vlr_mt < 0.01 and vlr_clipp >= 0.01:
        return "sem_mt"
    if vlr_mt >= 0.01 and vlr_clipp < 0.01:
        return "sem_clipp"
    gap = vlr_mt - vlr_clipp
    m = max(abs(vlr_mt), abs(vlr_clipp), 0.0001)
    frac = abs(gap) / m
    if abs(gap) >= LIMIAR_MEIA_NOTA_VLR and frac >= LIMIAR_MEIA_NOTA_PCT:
        return "meia_nota"
    return "alinhado"


def _reconcil_rows_enrich(
    rows: list[dict], *, is_venda: bool
) -> list[dict]:
    out: list[dict] = []
    for r in rows:
        d = {k: r[k] for k in r}
        vmt = float(d.get("VLR_MT") or 0)
        vcl = float(d.get("VLR_CLIPP") or 0)
        gap = vmt - vcl
        m = max(abs(vmt), abs(vcl), 0.0001)
        frac = abs(gap) / m if m > 0 else 0.0
        d["VLR_MT"] = round(vmt, 2)
        d["VLR_CLIPP"] = round(vcl, 2)
        d["GAP_VLR"] = round(gap, 2)
        d["GAP_FRAC"] = round(frac, 6)
        qtd = float(d.get("QTD_ESTOQUE") or 0)
        d["QTD_ESTOQUE"] = round(qtd, 4)
        d["SITUACAO"] = _situacao_reconcil(vmt, vcl)
        if is_venda and qtd > 0.0001 and vmt >= 1.0 and vcl < max(1.0, vmt * LIMIAR_MT_SEM_CLIPP_FRAC):
            d["ALERTA_MT_SEM_CLIPP_ESTOQUE"] = True
        else:
            d["ALERTA_MT_SEM_CLIPP_ESTOQUE"] = False
        if not is_venda and qtd > 0.0001 and vmt >= 1.0 and vcl < max(1.0, vmt * LIMIAR_MT_SEM_CLIPP_FRAC):
            d["ALERTA_COMPRA_MT_SEM_CLIPP_ESTOQUE"] = True
        else:
            d["ALERTA_COMPRA_MT_SEM_CLIPP_ESTOQUE"] = False
        out.append(_row_dict_clean(d))
    return out


def _reconcil_kpis(rows: list[dict], *, is_venda: bool) -> dict[str, float | int]:
    t_mt = sum(float(x.get("VLR_MT") or 0) for x in rows)
    t_cl = sum(float(x.get("VLR_CLIPP") or 0) for x in rows)
    n = len(rows)
    c_meia = sum(1 for x in rows if x.get("SITUACAO") == "meia_nota")
    c_scl = sum(1 for x in rows if x.get("SITUACAO") == "sem_clipp")
    c_smt = sum(1 for x in rows if x.get("SITUACAO") == "sem_mt")
    alt = 0
    for x in rows:
        if is_venda and x.get("ALERTA_MT_SEM_CLIPP_ESTOQUE"):
            alt += 1
        if not is_venda and x.get("ALERTA_COMPRA_MT_SEM_CLIPP_ESTOQUE"):
            alt += 1
    return {
        "total_mt": round(t_mt, 2),
        "total_clipp": round(t_cl, 2),
        "gap": round(t_mt - t_cl, 2),
        "count_produtos": n,
        "count_meia_nota": c_meia,
        "count_sem_clipp": c_scl,
        "count_sem_mt": c_smt,
        "count_alertas_estoque": int(alt),
    }


@router.get("/reconciliacao-ger-fiscal")
def dash_reconciliacao_ger_fiscal(
    tipo: Annotated[str, Query()] = "compras",
    ano: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    """Cruzamento MT (_2) x CLIPP (sem sufixo) no mesmo mês, por `ID_IDENTIFICADOR`."""
    if str(tipo).lower() not in ("compras", "vendas"):
        raise HTTPException(status_code=400, detail="tipo: compras ou vendas")
    t = date.today()
    a = int(ano) if ano is not None else t.year
    m_ = int(mes) if mes is not None else t.month
    d0, d1 = _mes_para_intervalo(a, m_)
    arq = (
        "reconciliacao_compras_ger_fiscal.sql"
        if str(tipo).lower() == "compras"
        else "reconciliacao_vendas_ger_fiscal.sql"
    )
    is_v = str(tipo).lower() == "vendas"
    try:
        sql = _reconcil_sql_mes(arq, d0, d1)
        _, raw = _execute(sql, max_rows=None)
        en = _reconcil_rows_enrich(raw, is_venda=is_v)
        k = _reconcil_kpis(en, is_venda=is_v)
        k["de"] = d0.isoformat()
        k["ate"] = d1.isoformat()
        k["limiar_meia_pct"] = LIMIAR_MEIA_NOTA_PCT
        k["limiar_meia_vlr"] = LIMIAR_MEIA_NOTA_VLR
        k["explicado"] = (
            "Compara o módulo usado no caminhão (MT) com o sistema no escritório, "
            "no mesmo mês. Compras: notas de entrada. Vendas: notas de saída. "
            "A quantidade em estoque exibida vem do cadastro usado no móvel."
        )
        return {
            "tipo": str(tipo).lower(),
            "kpis": k,
            "rows": en,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.api_route("/cobranca/alerta-atraso/executar", methods=["GET", "POST"])
def dash_cobranca_alerta_atraso_executar(
    chave: Annotated[str | None, Query()] = None,
    x_alerta_chave: Annotated[str | None, Header()] = None,
):
    """
    Clientes em atraso > COBRANCA_ATRASO_DIAS (default 60), sem apontamento no mês e sem baixa no mês; envia WhatsApp.
    Mesmas tabelas que o dashboard de receber (sufixo _2 opcional via .env).

    Crontab diário (ex.: 08:00):
    `curl -sS -H 'X-Alerta-Chave: SENHA' 'http://127.0.0.1:8091/dash/cobranca/alerta-atraso/executar'`
    Use `COBRANCA_ALERTA_CHAVE` no .env (se vazio, não exige cabeçalho — só em rede fechada).
    """
    segredo = (os.getenv("COBRANCA_ALERTA_CHAVE") or "").strip()
    if segredo and (x_alerta_chave or chave or "") != segredo:
        raise HTTPException(status_code=401, detail="chave de alerta de cobrança inválida")
    try:
        from cobranca_alerta_atraso import run_cobranca_alerta_atraso_diario

        return run_cobranca_alerta_atraso_diario(_execute)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.api_route("/cobranca/alerta-atraso/teste", methods=["GET", "POST"])
def dash_cobranca_alerta_atraso_teste(
    chave: Annotated[str | None, Query()] = None,
    x_alerta_chave: Annotated[str | None, Header()] = None,
):
    """Executa a mesma consulta do alerta diário, sem enviar WhatsApp (dry_run)."""
    segredo = (os.getenv("COBRANCA_ALERTA_CHAVE") or "").strip()
    if segredo and (x_alerta_chave or chave or "") != segredo:
        raise HTTPException(status_code=401, detail="chave de alerta de cobrança inválida")
    try:
        from cobranca_alerta_atraso import run_cobranca_alerta_atraso_diario

        return run_cobranca_alerta_atraso_diario(_execute, dry_run=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.api_route("/estoque/alerta-negativo/executar", methods=["GET", "POST"])
def dash_estoque_alerta_negativo_executar(
    chave: Annotated[str | None, Query()] = None,
    x_alerta_chave: Annotated[str | None, Header()] = None,
):
    """
    Chama a verificação de QTD_ATUAL < 0 (TB_EST_PRODUTO_2) e envia WhatsApp (WAHA) em novas
    ocorrências. Colocar no crontab (ex. a cada 2–5 min):
    `curl -sS -H 'X-Alerta-Chave: SENHA' http://127.0.0.1:8091/dash/estoque/alerta-negativo/executar`
    Se `ALERTA_ESTOQUE_CHAVE` não estiver no .env, só quem acessa localhost deveria chamar a API.
    """
    segredo = (os.getenv("ALERTA_ESTOQUE_CHAVE") or "").strip()
    if segredo and (x_alerta_chave or chave or "") != segredo:
        raise HTTPException(status_code=401, detail="chave de alerta inválida")
    try:
        from estoque_alerta import run_alerta_negativo

        return run_alerta_negativo(_execute)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.api_route("/estoque/alerta-negativo/teste", methods=["GET", "POST"])
def dash_estoque_alerta_negativo_teste(
    chave: Annotated[str | None, Query()] = None,
    x_alerta_chave: Annotated[str | None, Header()] = None,
):
    """
    Envia agora (teste) um único WhatsApp com **todos** os produtos negativos atuais.
    Não mexe no estado usado pelo `/executar`. Mesma regra de `ALERTA_ESTOQUE_CHAVE`.
    """
    segredo = (os.getenv("ALERTA_ESTOQUE_CHAVE") or "").strip()
    if segredo and (x_alerta_chave or chave or "") != segredo:
        raise HTTPException(status_code=401, detail="chave de alerta inválida")
    try:
        from estoque_alerta import run_alerta_teste_instantaneo

        return run_alerta_teste_instantaneo(_execute)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/resumo-diario")
def dash_resumo_diario():
    """KPIs do dia e MTD vs mês anterior (baixas + vendas NF; fluxo = recebimentos − pagos)."""
    try:
        return _dash_resumo_diario_payload()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
