"""
API interna Firebird CLIPP — exposta apenas em 127.0.0.1 (Nginx não encaminha).
"""
import os
from contextlib import contextmanager

import firebirdsql
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import dashboard as dash_module

load_dotenv("/var/www/construneves/.env")
load_dotenv()

def _env(key: str, default: str = "") -> str:
    v = os.getenv(key, default)
    return (v or "").strip()


HOST = _env("FIREBIRD_HOST", "100.84.122.3")
PORT = int(_env("FIREBIRD_PORT", "3050") or "3050")
DATABASE = _env("FIREBIRD_DATABASE", r"C:/MT/Clipp/Base/CLIPP.FDB")
USER = _env("FIREBIRD_USER", "SYSDBA")
PASSWORD = _env("FIREBIRD_PASSWORD", "")

app = FastAPI(title="Construneves Firebird API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def firebird_connection():
    conn = firebirdsql.connect(
        host=HOST,
        database=DATABASE,
        user=USER,
        password=PASSWORD,
        port=PORT,
    )
    try:
        yield conn
    finally:
        conn.close()


def rows_to_dicts(cur):
    rows = cur.fetchall()
    if not cur.description:
        return [], []
    columns = [d[0].strip() if isinstance(d[0], str) else d[0] for d in cur.description]
    out = []
    for row in rows:
        line = {}
        for i, col in enumerate(columns):
            val = row[i]
            if hasattr(val, "isoformat"):
                val = val.isoformat()
            line[col] = val
        out.append(line)
    return columns, out


dash_module.wire(rows_to_dicts, firebird_connection)
app.include_router(dash_module.router)


@app.get("/health")
def health():
    try:
        with firebird_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1 AS OK FROM RDB$DATABASE")
            cur.fetchone()
            cur.close()
        return {"ok": True, "firebird": True}
    except Exception as e:
        return {"ok": False, "firebird": False, "error": str(e)}


@app.get("/sample/tables")
def sample_tables(limit: int = 30):
    limit = max(1, min(limit, 200))
    sql = f"""
        SELECT FIRST {limit} TRIM(RDB$RELATION_NAME) AS TABLE_NAME
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$RELATION_NAME
    """
    try:
        with firebird_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql)
            _, data = rows_to_dicts(cur)
            cur.close()
        return {"rows": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


class QueryBody(BaseModel):
    sql: str


# Bloqueia escrita acidental — apenas SELECT (case-insensitive, trim).
def _assert_read_only_sql(sql: str) -> None:
    s = sql.strip().strip(";").strip()
    if not s.upper().startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Apenas SELECT é permitido")


@app.post("/query")
def run_query(body: QueryBody):
    _assert_read_only_sql(body.sql)
    try:
        with firebird_connection() as conn:
            cur = conn.cursor()
            cur.execute(body.sql)
            columns, data = rows_to_dicts(cur)
            cur.close()
        return {"columns": columns, "rows": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
