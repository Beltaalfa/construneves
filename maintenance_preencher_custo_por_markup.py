#!/usr/bin/env python3
"""
Preenche PRC_CUSTO aproximado em TB_ESTOQUE_2 (módulo _2) para itens sem custo
(COALESCE(PRC_CUSTO,0) <= 0) com PRC_VENDA > 0, usando a mesma convenção
do painel: markup no cadastro = (VENDA - CUSTO) / CUSTO * 100, logo
  CUSTO = VENDA / (1 + mk/100).

Ordem de mk: MARGEM_LB do item (se > 0), MARGEM do TB_EST_GRUPO (se > 0),
média do markup implícito dos outros itens do mesmo grupo (com custo>0),
ou 50,0% como fallback.

Uso: python3 maintenance_preencher_custo_por_markup.py [--dry-run]
"""
from __future__ import annotations

import argparse
import os
import sys
from decimal import Decimal, ROUND_HALF_UP, getcontext

getcontext().prec = 28

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(_: str) -> None:
        return


def d4(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Só lista alterações, não grava",
    )
    ap.add_argument(
        "--default-mk",
        type=float,
        default=50.0,
        help="Markup %% quando não houver item/grupo/média (padrão 50)",
    )
    args = ap.parse_args()
    dry = args.dry_run
    default_mk = Decimal(str(args.default_mk))

    here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(here, ".env"))
    load_dotenv()

    import firebirdsql  # type: ignore

    conn = firebirdsql.connect(
        host=(os.getenv("FIREBIRD_HOST") or "").strip(),
        database=(os.getenv("FIREBIRD_DATABASE") or "").strip(),
        user=(os.getenv("FIREBIRD_USER") or "").strip(),
        password=(os.getenv("FIREBIRD_PASSWORD") or "").strip(),
        port=int(os.getenv("FIREBIRD_PORT", "3050") or 3050),
    )

    cur = conn.cursor()

    # Média de markup implícito por grupo (só itens com custo e venda)
    cur.execute(
        """
        SELECT
            E.ID_GRUPO,
            AVG( ((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_CUSTO, 0)) * 100.0 ) AS MK_MEDIO
        FROM TB_ESTOQUE_2 E
        WHERE COALESCE(E.PRC_CUSTO, 0) > 0
          AND COALESCE(E.PRC_VENDA, 0) > 0
          AND E.ID_GRUPO IS NOT NULL
        GROUP BY E.ID_GRUPO
    """
    )
    avg_by_group: dict[int, Decimal] = {}
    for gid, mk in cur.fetchall():
        if gid is None or mk is None:
            continue
        avg_by_group[int(gid)] = Decimal(str(mk))

    cur.execute(
        """
        SELECT
            G.ID_GRUPO,
            G.MARGEM
        FROM TB_EST_GRUPO G
    """
    )
    margem_grupo: dict[int, Decimal] = {}
    for gid, m in cur.fetchall():
        if gid is not None and m is not None:
            margem_grupo[int(gid)] = Decimal(str(m))

    cur.execute(
        """
        SELECT
            E.ID_ESTOQUE,
            E.PRC_VENDA,
            E.MARGEM_LB,
            E.ID_GRUPO
        FROM TB_ESTOQUE_2 E
        WHERE COALESCE(E.PRC_CUSTO, 0) <= 0
          AND COALESCE(E.PRC_VENDA, 0) > 0
    """
    )
    cands = cur.fetchall()
    upd_sql = "UPDATE TB_ESTOQUE_2 SET PRC_CUSTO = ? WHERE ID_ESTOQUE = ?"
    n = 0
    for row in cands:
        id_e, p_vend, m_lb, id_g = row
        vend = Decimal(str(p_vend))
        mk: Decimal | None = None
        m_lb = (
            None if m_lb is None
            else Decimal(str(m_lb))
        )
        if m_lb is not None and m_lb > 0:
            mk = m_lb
        elif id_g is not None:
            gid = int(id_g)
            gmk = margem_grupo.get(gid)
            if gmk is not None and gmk > 0:
                mk = gmk
        if mk is None and id_g is not None:
            mk = avg_by_group.get(int(id_g))
        if mk is None or mk <= 0:
            mk = default_mk
        fator = Decimal(1) + (mk / Decimal(100))
        if fator <= 0:
            print(f"Ignorar ID_ESTOQUE={id_e} (markup {mk} levaria a fator inválido)", file=sys.stderr)
            continue
        novo = d4(vend / fator)
        n += 1
        if dry:
            print(
                f"ID_ESTOQUE={id_e}  VENDA={vend}  mk%={mk}  ->  PRC_CUSTO={novo}",
            )
        else:
            cur.execute(upd_sql, (float(novo), int(id_e)))

    if not dry and n:
        conn.commit()
    else:
        conn.rollback()
    if dry:
        print(f"[dry-run] {n} linha(s) seriam atualizadas.")
    else:
        print(f"Concluído. Atualizados: {n} (COMMIT).")

    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
