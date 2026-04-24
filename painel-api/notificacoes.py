"""
Destinatários WhatsApp para alertas (lista editável pelo painel).

Persistência: JSON em disco (mesmo padrão que `estoque_alerta` / estado).
Compatível com `WHATSAPP_ALERTA_ESTOQUE_PARA` quando a lista fica vazia.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


def _env(k: str, d: str = "") -> str:
    return (os.getenv(k) or d).strip()


def destinatarios_path() -> Path:
    p = _env("NOTIFICACOES_DESTINATARIOS_PATH", "")
    if p:
        return Path(p)
    return Path("/var/www/construneves/data/notificacoes_destinatarios.json")


def normalize_phone(raw: str) -> str:
    return re.sub(r"\D", "", (raw or "").strip())


MAX_RECIPIENTS = 30
MIN_DIGITS = 10
MAX_DIGITS = 15


def read_store() -> dict[str, Any]:
    """Lê o JSON completo: estoque (`recipients`) e cobrança (`recipientsCobranca`)."""
    path = destinatarios_path()
    if not path.is_file():
        return {"recipients": [], "recipientsCobranca": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"recipients": [], "recipientsCobranca": []}
    if not isinstance(data, dict):
        return {"recipients": [], "recipientsCobranca": []}
    rec = data.get("recipients")
    cob = data.get("recipientsCobranca")
    if not isinstance(rec, list):
        rec = []
    if not isinstance(cob, list):
        cob = []
    return {"recipients": rec, "recipientsCobranca": cob}


def save_store(doc: dict[str, Any]) -> None:
    path = destinatarios_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "recipients": doc.get("recipients") if isinstance(doc.get("recipients"), list) else [],
        "recipientsCobranca": doc.get("recipientsCobranca")
        if isinstance(doc.get("recipientsCobranca"), list)
        else [],
    }
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")


def list_phones_for_alerta() -> list[str]:
    """
    Números a notificar (WAHA). Ordem preservada, sem duplicados.
    Se a lista guardada estiver vazia, usa `WHATSAPP_ALERTA_ESTOQUE_PARA`.
    """
    doc = read_store()
    out: list[str] = []
    seen: set[str] = set()
    for row in doc.get("recipients") or []:
        if not isinstance(row, dict):
            continue
        p = normalize_phone(str(row.get("phone") or ""))
        if len(p) < MIN_DIGITS or len(p) > MAX_DIGITS:
            continue
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    if not out:
        leg = normalize_phone(_env("WHATSAPP_ALERTA_ESTOQUE_PARA", ""))
        if len(leg) >= MIN_DIGITS and len(leg) <= MAX_DIGITS:
            out.append(leg)
    return out


def list_phones_for_cobranca_alerta() -> list[str]:
    """
    Destinatários do alerta diário de cobrança (atraso + sem apontamento/recebimento no mês).
    Lista `recipientsCobranca` no JSON; se vazia, `WHATSAPP_COBRANCA_ATRASO_PARA` (default 5534988070651).
    """
    doc = read_store()
    out: list[str] = []
    seen: set[str] = set()
    for row in doc.get("recipientsCobranca") or []:
        if not isinstance(row, dict):
            continue
        p = normalize_phone(str(row.get("phone") or ""))
        if len(p) < MIN_DIGITS or len(p) > MAX_DIGITS:
            continue
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    if not out:
        leg = normalize_phone(_env("WHATSAPP_COBRANCA_ATRASO_PARA", "5534988070651"))
        if len(leg) >= MIN_DIGITS and len(leg) <= MAX_DIGITS:
            out.append(leg)
    return out


class RecipientIn(BaseModel):
    phone: str = Field(..., min_length=1, max_length=32)
    label: str = Field(default="", max_length=80)


class RecipientsPutBody(BaseModel):
    """Pode enviar só `recipients`, só `recipientsCobranca`, ou ambos — o que faltar mantém-se em disco."""

    recipients: list[RecipientIn] | None = None
    recipientsCobranca: list[RecipientIn] | None = None


def _validate_recipient_list(items: list[RecipientIn]) -> list[dict[str, str]]:
    if len(items) > MAX_RECIPIENTS:
        raise HTTPException(
            status_code=400,
            detail=f"No máximo {MAX_RECIPIENTS} números.",
        )
    cleaned: list[dict[str, str]] = []
    for r in items:
        p = normalize_phone(r.phone)
        if not p:
            raise HTTPException(status_code=400, detail="Telefone vazio")
        if len(p) < MIN_DIGITS or len(p) > MAX_DIGITS:
            raise HTTPException(
                status_code=400,
                detail=f"Telefone inválido ({p}): use {MIN_DIGITS}–{MAX_DIGITS} dígitos (ex.: 5537999990000)",
            )
        label = (r.label or "").strip()[:80]
        cleaned.append({"phone": p, "label": label})
    return cleaned


def _rows_from_store_list(raw: list[Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in raw or []:
        if not isinstance(row, dict):
            continue
        p = normalize_phone(str(row.get("phone") or ""))
        if not p:
            continue
        rows.append(
            {
                "phone": p,
                "label": str(row.get("label") or "").strip()[:80],
            }
        )
    return rows


@router.get("/recipients")
def get_recipients():
    store = read_store()
    rows = _rows_from_store_list(store.get("recipients"))
    legacy = normalize_phone(_env("WHATSAPP_ALERTA_ESTOQUE_PARA", ""))
    prefilled_from_env = False
    if not rows and MIN_DIGITS <= len(legacy) <= MAX_DIGITS:
        rows = [{"phone": legacy, "label": ""}]
        prefilled_from_env = True

    rows_cob = _rows_from_store_list(store.get("recipientsCobranca"))
    legacy_cob = normalize_phone(_env("WHATSAPP_COBRANCA_ATRASO_PARA", "5534988070651"))
    prefilled_cob = False
    if not rows_cob and MIN_DIGITS <= len(legacy_cob) <= MAX_DIGITS:
        rows_cob = [{"phone": legacy_cob, "label": ""}]
        prefilled_cob = True

    return {
        "recipients": rows,
        "recipientsCobranca": rows_cob,
        "fallbackEnvPhone": legacy if legacy else None,
        "emptyUsesEnvFallback": True,
        "prefilledFromEnv": prefilled_from_env,
        "fallbackEnvPhoneCobranca": legacy_cob if legacy_cob else None,
        "emptyUsesEnvFallbackCobranca": True,
        "prefilledFromEnvCobranca": prefilled_cob,
    }


@router.put("/recipients")
def put_recipients(body: RecipientsPutBody):
    if body.recipients is None and body.recipientsCobranca is None:
        raise HTTPException(
            status_code=400,
            detail="Envie recipients e/ou recipientsCobranca.",
        )
    # Painel envia as duas listas de cada vez: grava o par completo e evita apagar uma ao gravar a outra.
    if body.recipients is not None and body.recipientsCobranca is not None:
        rec = _validate_recipient_list(body.recipients)
        cob = _validate_recipient_list(body.recipientsCobranca)
        save_store({"recipients": rec, "recipientsCobranca": cob})
        return {
            "ok": True,
            "count": len(rec),
            "countCobranca": len(cob),
            "recipients": rec,
            "recipientsCobranca": cob,
        }
    # Compatível com clientes que só enviam um campo (merge com disco).
    store = read_store()
    if body.recipients is not None:
        store["recipients"] = _validate_recipient_list(body.recipients)
    if body.recipientsCobranca is not None:
        store["recipientsCobranca"] = _validate_recipient_list(body.recipientsCobranca)
    save_store(store)
    rec_out = _rows_from_store_list(store.get("recipients"))
    cob_out = _rows_from_store_list(store.get("recipientsCobranca"))
    return {
        "ok": True,
        "count": len(store["recipients"]),
        "countCobranca": len(store["recipientsCobranca"]),
        "recipients": rec_out,
        "recipientsCobranca": cob_out,
    }


@router.post("/test")
def post_test():
    """Envia uma mensagem de teste a todos os destinatários activos (mesma lógica do alerta)."""
    from estoque_alerta import send_test_message_to_all_recipients

    return send_test_message_to_all_recipients()


@router.post("/test-cobranca")
def post_test_cobranca():
    """Mensagem curta de teste só aos números da lista de cobrança (WAHA)."""
    from estoque_alerta import send_waha_text_to_phone_list

    phones = list_phones_for_cobranca_alerta()
    if _env("COBRANCA_ALERTA_ATRASO_DESLIGADO", "").lower() in ("1", "true", "yes", "sim"):
        return {"ok": True, "skipped": True, "reason": "COBRANCA_ALERTA_ATRASO_DESLIGADO"}
    text = (
        "TESTE — Construneves (cobrança)\n\n"
        "Mensagem de verificação dos destinatários do alerta diário de inadimplência."
    )
    if _env("COBRANCA_ALERTA_ATRASO_DRY_RUN", "").lower() in ("1", "true", "yes", "sim"):
        return {
            "ok": True,
            "dry_run": True,
            "texto": text,
            "destinos": phones,
        }
    if not phones:
        return {"ok": False, "erro": "Nenhum número configurado para cobrança"}
    ok, det = send_waha_text_to_phone_list(phones, text)
    if not ok:
        return {"ok": False, "erro": det, "destinos": phones}
    return {"ok": True, "whats": True, "resposta": det, "destinos": phones}


@router.post("/pedido-compra-negativos")
def post_pedido_compra_negativos():
    """
    Adiciona linhas na ordem de compra aberta actual (`tb_ped_compra_ordem_item`), uma por produto
    negativo (quantidade = |QTD_ATUAL|); se a linha já existir, soma à quantidade.
    Inclui `VLR_UNIT` no INSERT quando a coluna existir (ver `CONSTRUNEVES_PED_COMPRA_COL_VLR_UNIT`).
    Ver CONSTRUNEVES_PED_COMPRA_* em .env.example.
    """
    import dashboard as dash_module
    from pedido_compra_negativos import run_adicionar_negativos_ped_compra_aberto

    return run_adicionar_negativos_ped_compra_aberto(
        dash_module._execute,
        dash_module.firebird_conn_context,
    )


@router.post("/cobranca-alerta-atraso-60d")
def post_cobranca_alerta_atraso_60d():
    """
    Mesma lógica de GET/POST `/dash/cobranca/alerta-atraso/executar` (WhatsApp ao setor de cobrança).
    Útil para botão no painel Notificações ou automação interna.
    """
    import dashboard as dash_module
    from cobranca_alerta_atraso import run_cobranca_alerta_atraso_diario

    return run_cobranca_alerta_atraso_diario(dash_module._execute)


@router.post("/cobranca-alerta-atraso-60d/teste")
def post_cobranca_alerta_atraso_60d_teste():
    """Consulta + texto que seria enviado, sem WhatsApp (dry_run)."""
    import dashboard as dash_module
    from cobranca_alerta_atraso import run_cobranca_alerta_atraso_diario

    return run_cobranca_alerta_atraso_diario(dash_module._execute, dry_run=True)


@router.post("/reenviar-estoque-negativo")
def post_reenviar_estoque_negativo():
    """
    Um WhatsApp por destinatário com a **lista completa** actual de produtos com QTD_ATUAL < 0.
    Não altera o ficheiro de estado do alerta por transição (`/dash/estoque/alerta-negativo/executar`).
    """
    import dashboard as dash_module
    from estoque_alerta import run_alerta_reenvio_todos_negativos

    return run_alerta_reenvio_todos_negativos(dash_module._execute)
