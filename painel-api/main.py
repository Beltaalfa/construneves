"""
API interna Firebird CLIPP — exposta apenas em 127.0.0.1 (Nginx não encaminha).
"""
import logging
import os
import threading
import time
from contextlib import asynccontextmanager, contextmanager

import firebirdsql
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import dashboard as dash_module
import cobranca as cobranca_module
import notificacoes as notificacoes_module

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

log_alerta = logging.getLogger("estoque_alerta_auto")
_alerta_loop_stop = threading.Event()

# Só inicia o loop com intervalo > 0 (segundos). 0 = desligado (usar só cron, se quiser).
def _parse_alerta_intervalo() -> int:
    raw = _env("ALERTA_ESTOQUE_INTERVALO_SEG", "45")
    if raw == "":
        return 45
    try:
        n = int(raw)
    except ValueError:
        return 45
    return max(0, n)


def _estoque_alerta_loop_thread(intervalo: int) -> None:
    from estoque_alerta import run_alerta_negativo
    from pedido_compra_negativos import run_auto_adicionar_nao_positivos_em_transicao

    time.sleep(2)
    while not _alerta_loop_stop.is_set():
        if _env("ALERTA_ESTOQUE_DESLIGADO", "").lower() in (
            "1",
            "true",
            "yes",
            "sim",
        ):
            if _alerta_loop_stop.wait(timeout=intervalo):
                return
            continue
        try:
            if _env("WAHA_BASE_URL") and _env("WHATSAPP_ALERTA_ESTOQUE_PARA"):
                run_alerta_negativo(dash_module._execute)
            run_auto_adicionar_nao_positivos_em_transicao(
                dash_module._execute,
                dash_module.firebird_conn_context,
            )
        except Exception as e:
            log_alerta.exception("alerta estoque automático: %s", e)
        if _alerta_loop_stop.wait(timeout=intervalo):
            return


@asynccontextmanager
async def _lifespan(app: FastAPI):
    if not log_alerta.handlers:
        h = logging.StreamHandler()
        h.setFormatter(
            logging.Formatter("%(levelname)s [%(name)s] %(message)s")
        )
        log_alerta.addHandler(h)
        log_alerta.setLevel(logging.INFO)
        log_alerta.propagate = False
    n = _parse_alerta_intervalo()
    t: threading.Thread | None = None
    if n > 0:
        t = threading.Thread(
            target=_estoque_alerta_loop_thread,
            name="estoque-alerta-negativo",
            args=(n,),
            daemon=True,
        )
        t.start()
        log_alerta.info("Alerta de estoque negativo ativo: a cada %s s (WAHA).", n)
    else:
        log_alerta.info(
            "ALERTA_ESTOQUE_INTERVALO_SEG=0: alerta automático desligado (use cron em /executar se precisar)."
        )
    yield
    _alerta_loop_stop.set()
    if t and t.is_alive():
        t.join(timeout=2.0)


app = FastAPI(
    title="Construneves Firebird API", version="1.0.0", lifespan=_lifespan
)
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
app.include_router(notificacoes_module.router)
app.include_router(cobranca_module.router)


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
