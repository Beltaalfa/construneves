"""
Alerta de estoque negativo via WhatsApp (WAHA).

- Só notifica na **transição** (estava >= 0 ou desconhecido, agora < 0),
  evitando spam enquanto continua negativo. Ao voltar a >= 0, liberta para
  notificar de novo noutro dia negativo.

Variáveis de ambiente: ver .env.example
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

STATE_KEY_NEG = "ids_negativos_ultima_execucao"
STATE_KEY_INIC = "inicializado"


def _env(k: str, d: str = "") -> str:
    return (os.getenv(k) or d).strip()


def _state_path() -> Path:
    p = _env("ALERTA_ESTOQUE_ESTADO_PATH", "")
    if p:
        return Path(p)
    return Path("/var/www/construneves/data/estoque_alerta_negativo_state.json")


def _waha_url() -> str:
    base = _env("WAHA_BASE_URL", "").rstrip("/")
    if not base:
        return ""
    return f"{base}/api/sendText"


def _chat_id(phone: str) -> str:
    """Ex.: 5537996704090 -> 5537996704090@c.us"""
    p = re.sub(r"\D", "", phone)
    if p.startswith("55") and len(p) >= 12:
        return f"{p}@c.us"
    if not p:
        return ""
    return f"{p}@c.us"


def _load_state() -> dict[str, Any]:
    path = _state_path()
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("estoque_alerta: não leu estado %s: %s", path, e)
        return {}


def _save_state(data: dict[str, Any]) -> None:
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")


def _row_key(r: dict) -> str:
    return str(int(r["ID_IDENTIFICADOR"]))


def _format_mensagem(linhas: list[dict], titulo: str) -> str:
    out: list[str] = [titulo, ""]
    for r in linhas:
        iid = r["ID_IDENTIFICADOR"]
        item = str(r.get("ITEM") or "")
        ref = str(r.get("REFERENCIA") or "")
        q = r.get("QTD_ATUAL")
        qf = f"{float(q):,.4f}".replace(",", "X").replace(".", ",").replace("X", ".")
        extra = f"  Ref. {ref}" if ref else ""
        out.append(f"• ID {iid} — {item or '(sem descrição)'}{extra}")
        out.append(f"  Qtd: {qf}")
    out.append("")
    out.append(f"Total: {len(linhas)} produto(s).")
    return "\n".join(out)


def _phones_for_waha() -> list[str]:
    """Lista de telefones só dígitos (painel Notificações ou variável de ambiente)."""
    try:
        from notificacoes import list_phones_for_alerta

        return list_phones_for_alerta()
    except Exception as e:
        logger.warning("_phones_for_waha: %s", e)
        phone = _env("WHATSAPP_ALERTA_ESTOQUE_PARA", "")
        p = re.sub(r"\D", "", phone)
        return [p] if len(p) >= 10 else []


def _send_waha_one(phone_digits: str, text: str) -> tuple[bool, str]:
    url = _waha_url()
    if not url:
        return False, "WAHA_BASE_URL não definido"
    key = _env("WAHA_API_KEY", "")
    if not key:
        return False, "WAHA_API_KEY não definido"
    chat = _chat_id(phone_digits)
    if not chat:
        return False, "chatId vazio"
    session = _env("WAHA_SESSION", "default")
    body = json.dumps(
        {"session": session, "chatId": chat, "text": text},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Api-Key": key,
            "User-Agent": "curl/8.4 ConstrunevesEstoqueAlerta/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        return True, raw[:500]
    except urllib.error.HTTPError as e:
        b = e.read().decode("utf-8", errors="replace")
        return False, f"HTTP {e.code}: {b[:400]}"
    except OSError as e:
        return False, str(e)


def _send_waha(text: str) -> tuple[bool, str]:
    """Envia a mesma mensagem a todos os destinatários configurados."""
    phones = _phones_for_waha()
    if not phones:
        return False, "Nenhum número: use o painel Notificações ou WHATSAPP_ALERTA_ESTOQUE_PARA"
    return send_waha_text_to_phone_list(phones, text)


def send_waha_text_to_phone_list(phones: list[str], text: str) -> tuple[bool, str]:
    """
    Envia o mesmo texto via WAHA a uma lista explícita de telefones (só dígitos).
    Usado por alertas que não devem usar a lista geral do painel (ex.: cobrança).
    """
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in phones:
        p = re.sub(r"\D", "", raw or "")
        if len(p) < 10 or len(p) > 15:
            continue
        if p in seen:
            continue
        seen.add(p)
        cleaned.append(p)
    if not cleaned:
        return False, "Lista de telefones vazia ou inválida"
    errors: list[str] = []
    for ph in cleaned:
        ok, det = _send_waha_one(ph, text)
        if not ok:
            errors.append(f"{ph}: {det}")
    if errors:
        return False, "; ".join(errors)[:900]
    return True, f"Enviado a {len(cleaned)} número(s)"


def send_test_message_to_all_recipients() -> dict[str, Any]:
    """Um WhatsApp de teste por destinatário (WAHA)."""
    if _env("ALERTA_ESTOQUE_DESLIGADO", "").lower() in ("1", "true", "yes", "sim"):
        return {"ok": True, "skipped": True, "reason": "ALERTA_ESTOQUE_DESLIGADO"}
    text = (
        "TESTE — Construneves\n\n"
        "Mensagem de verificação dos destinatários de notificação (WhatsApp)."
    )
    phones = _phones_for_waha()
    if _env("ALERTA_DRY_RUN", "").lower() in ("1", "true"):
        return {
            "ok": True,
            "dry_run": True,
            "texto": text,
            "destinos": phones,
        }
    if not phones:
        return {"ok": False, "erro": "Nenhum número configurado"}
    ok, det = _send_waha(text)
    if not ok:
        return {"ok": False, "erro": det, "destinos": phones}
    return {"ok": True, "whats": True, "resposta": det, "destinos": phones}


def sql_produtos_negativos() -> str:
    return """
    SELECT
        P.ID_IDENTIFICADOR,
        TRIM(COALESCE(E.DESCRICAO, '')) AS ITEM,
        TRIM(COALESCE(P.REFERENCIA, '')) AS REFERENCIA,
        COALESCE(P.QTD_ATUAL, 0) AS QTD_ATUAL
    FROM TB_EST_PRODUTO_2 P
    INNER JOIN TB_EST_IDENTIFICADOR_2 I ON I.ID_IDENTIFICADOR = P.ID_IDENTIFICADOR
    INNER JOIN TB_ESTOQUE_2 E ON E.ID_ESTOQUE = I.ID_ESTOQUE
    WHERE COALESCE(P.QTD_ATUAL, 0) < 0
    ORDER BY P.ID_IDENTIFICADOR
    """


def run_alerta_negativo(
    _execute: Any,
) -> dict[str, Any]:
    """
    1) SELECT produtos com QTD_ATUAL < 0
    2) Novos em relação ao snapshot anterior
    3) Primeira execução sem negativos: só grava estado. Com negativos: um WhatsApp de arranque.
    4) Depois: WhatsApp quando surgir **novo** id negativo (não reenvia se continua negativo).
    """
    if _env("ALERTA_ESTOQUE_DESLIGADO", "").lower() in ("1", "true", "yes", "sim"):
        return {"ok": True, "skipped": True, "reason": "ALERTA_ESTOQUE_DESLIGADO"}

    _, rows = _execute(sql_produtos_negativos(), max_rows=None)
    now_set = {_row_key(r) for r in rows}
    state = _load_state()
    last_set: set[str] = set(
        str(x) for x in (state.get(STATE_KEY_NEG) or []) if str(x).strip()
    )
    init = bool(state.get(STATE_KEY_INIC))
    new_ids = now_set - last_set

    if not init:
        if not now_set:
            st = {**state, STATE_KEY_INIC: True, STATE_KEY_NEG: []}
            _save_state(st)
            return {
                "ok": True,
                "inicial": True,
                "negativos_agora": 0,
                "mensagem": "Primeira execução: estado gravado, sem notificação.",
            }
        # Já existiam negativos ao ligar o alerta: um resumo único.
        text = _format_mensagem(rows, "Inicialização — estoque negativo no arranque:")
        if _env("ALERTA_DRY_RUN", "").lower() in ("1", "true"):
            st = {**state, STATE_KEY_INIC: True, STATE_KEY_NEG: sorted(now_set, key=int)}
            _save_state(st)
            return {
                "ok": True,
                "inicial": True,
                "texto": text,
                "negativos_agora": len(now_set),
                "dry_run": True,
            }
        ok, det = _send_waha(text)
        if not ok:
            return {
                "ok": False,
                "inicial": True,
                "erro": det,
            }
        st = {**state, STATE_KEY_INIC: True, STATE_KEY_NEG: sorted(now_set, key=int)}
        _save_state(st)
        return {
            "ok": True,
            "inicial": True,
            "whats": True,
            "negativos_agora": len(now_set),
            "resposta": det[:500],
        }

    if not new_ids:
        state[STATE_KEY_NEG] = sorted(now_set, key=int)
        _save_state(state)
        return {
            "ok": True,
            "novos": 0,
            "negativos_agora": len(now_set),
        }

    novos: list[dict] = [r for r in rows if _row_key(r) in new_ids]
    text = _format_mensagem(
        sorted(novos, key=lambda x: int(x["ID_IDENTIFICADOR"])),
        "Estoque negativo (novo) — Construneves",
    )
    if _env("ALERTA_DRY_RUN", "").lower() in ("1", "true"):
        _save_state({**state, STATE_KEY_NEG: sorted(now_set, key=int), STATE_KEY_INIC: True})
        return {
            "ok": True,
            "dry_run": True,
            "texto": text,
            "novos": len(novos),
        }
    ok, det = _send_waha(text)
    if not ok:
        return {
            "ok": False,
            "erro": det,
            "novos": len(novos),
            "nao_atualizou_estado": True,
        }
    state[STATE_KEY_NEG] = sorted(now_set, key=int)
    _save_state(state)
    return {
        "ok": True,
        "whats": True,
        "novos": len(novos),
        "resposta": det,
    }


def run_alerta_teste_instantaneo(_execute: Any) -> dict[str, Any]:
    """
    Envia **um** WhatsApp com o snapshot atual de estoque negativo.
    Não altera o ficheiro de estado (o alerta por transição continua independente).
    """
    if _env("ALERTA_ESTOQUE_DESLIGADO", "").lower() in ("1", "true", "yes", "sim"):
        return {"ok": True, "skipped": True, "reason": "ALERTA_ESTOQUE_DESLIGADO"}
    _, rows = _execute(sql_produtos_negativos(), max_rows=None)
    if not rows:
        text = "TESTE — Estoque negativo: nenhum produto com QTD_ATUAL < 0 no momento."
    else:
        text = _format_mensagem(
            sorted(rows, key=lambda x: int(x["ID_IDENTIFICADOR"])),
            "TESTE — Estoque negativo (snapshot agora, Construneves):",
        )
    if _env("ALERTA_DRY_RUN", "").lower() in ("1", "true"):
        return {
            "ok": True,
            "dry_run": True,
            "texto": text,
            "count": len(rows),
        }
    ok, det = _send_waha(text)
    if not ok:
        return {"ok": False, "erro": det, "count": len(rows)}
    return {
        "ok": True,
        "whats": True,
        "count": len(rows),
        "resposta": det,
    }


def run_alerta_reenvio_todos_negativos(_execute: Any) -> dict[str, Any]:
    """
    Reenvia **todos** os itens com QTD_ATUAL < 0 num único WhatsApp por destinatário.
    Não altera o estado de transição do `/executar` (só snapshot actual).
    """
    if _env("ALERTA_ESTOQUE_DESLIGADO", "").lower() in ("1", "true", "yes", "sim"):
        return {"ok": True, "skipped": True, "reason": "ALERTA_ESTOQUE_DESLIGADO"}
    _, rows = _execute(sql_produtos_negativos(), max_rows=None)
    if not rows:
        text = (
            "Reenvio — estoque negativo (Construneves)\n\n"
            "Nenhum produto com QTD_ATUAL < 0 no momento."
        )
    else:
        text = _format_mensagem(
            sorted(rows, key=lambda x: int(x["ID_IDENTIFICADOR"])),
            "Reenvio — lista completa de itens com estoque negativo (Construneves):",
        )
    if _env("ALERTA_DRY_RUN", "").lower() in ("1", "true"):
        return {
            "ok": True,
            "dry_run": True,
            "texto": text,
            "count": len(rows),
            "tipo": "reenvio_todos_negativos",
        }
    ok, det = _send_waha(text)
    if not ok:
        return {"ok": False, "erro": det, "count": len(rows), "tipo": "reenvio_todos_negativos"}
    return {
        "ok": True,
        "whats": True,
        "count": len(rows),
        "resposta": det,
        "tipo": "reenvio_todos_negativos",
    }
