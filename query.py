"""
Conexão e execução de queries no Firebird CLIPP - uso em BI.
Independente do App-Cotação.

Uso:
  python query.py "SELECT * FROM SUA_TABELA WHERE ..."
  python query.py --file minha_query.sql
  python query.py "SELECT ..." --csv saida.csv
  python query.py "SELECT ..." --excel saida.xlsx
"""
import os
import sys
from pathlib import Path

import firebirdsql
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

HOST = os.getenv("FIREBIRD_HOST", "localhost")
PORT = int(os.getenv("FIREBIRD_PORT", "3050"))
DATABASE = os.getenv("FIREBIRD_DATABASE", r"C:\backup\CLIPP - Copia.FDB")
USER = os.getenv("FIREBIRD_USER", "SYSDBA")
PASSWORD = os.getenv("FIREBIRD_PASSWORD", "masterkey")


def connect():
    return firebirdsql.connect(
        host=HOST,
        database=DATABASE,
        user=USER,
        password=PASSWORD,
        port=PORT,
    )


def run_query(sql: str) -> pd.DataFrame:
    """Executa a query e retorna um DataFrame."""
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        columns = [d[0] for d in cur.description] if cur.description else []
        cur.close()
        return pd.DataFrame(rows, columns=columns)
    finally:
        conn.close()


def main():
    if len(sys.argv) < 2:
        print("Uso:")
        print('  python query.py "SELECT * FROM RDB$RELATIONS FETCH FIRST 5 ROWS ONLY"')
        print("  python query.py --file query.sql")
        print('  python query.py "SELECT ..." --csv saida.csv')
        print('  python query.py "SELECT ..." --excel saida.xlsx')
        sys.exit(1)

    if sys.argv[1] == "--file":
        if len(sys.argv) < 3:
            print("Informe o arquivo: python query.py --file query.sql")
            sys.exit(1)
        path = Path(sys.argv[2])
        if not path.exists():
            print(f"Arquivo não encontrado: {path}")
            sys.exit(1)
        sql = path.read_text(encoding="utf-8", errors="replace")
        args = sys.argv[3:]
    else:
        sql = sys.argv[1].strip()
        args = sys.argv[2:]

    out_csv = None
    out_excel = None
    i = 0
    while i < len(args):
        if args[i] == "--csv" and i + 1 < len(args):
            out_csv = args[i + 1]
            i += 2
            continue
        if args[i] == "--excel" and i + 1 < len(args):
            out_excel = args[i + 1]
            i += 2
            continue
        i += 1

    try:
        df = run_query(sql)
        print(f"Linhas: {len(df)}")
        print()
        print(df.to_string())
        if out_csv:
            df.to_csv(out_csv, index=False, encoding="utf-8-sig", sep=";", decimal=",")
            print(f"\nExportado: {out_csv}")
        if out_excel:
            df.to_excel(out_excel, index=False, engine="openpyxl")
            print(f"\nExportado: {out_excel}")
    except firebirdsql.OperationalError as e:
        print(f"Erro Firebird: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
