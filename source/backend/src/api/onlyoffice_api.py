import json
import logging
import urllib.request
import urllib.error

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.config import get_session
from database.models import DocumentModel, VersionModel
from database.repositories import S3Repository
from services.document_service import word_document_upload_filename
from settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/onlyoffice",
    tags=["ONLYOFFICE"],
)

_ONLYOFFICE_DOCKER_HOST = settings.onlyoffice_internal_url.rstrip("/")


def _rewrite_onlyoffice_url(url: str) -> str:
    """ONLYOFFICE sends download URLs with localhost:8082; replace with Docker hostname on port 80."""
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(url)
    if parsed.hostname in ("localhost", "127.0.0.1"):
        parsed = parsed._replace(netloc="onlyoffice")
        return urlunparse(parsed)
    return url


@router.get(
    "/download/{version_id}",
    description="Проксирование скачивания документа из S3 (без пользовательской авторизации, для ONLYOFFICE)",
)
def download_document_for_onlyoffice(
    version_id: int,
    db: Session = Depends(get_session),
) -> Response:
    version = db.get(VersionModel, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Версия не найдена")

    try:
        req = urllib.request.Request(version.s3_url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Не удалось скачать файл из хранилища: {exc}") from exc

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.post(
    "/callback/{document_id}",
    description="Callback от ONLYOFFICE Document Server (без пользовательской авторизации)",
)
async def onlyoffice_callback(
    document_id: int,
    request: Request,
    db: Session = Depends(get_session),
) -> JSONResponse:
    body = await request.json()
    print(f"[CALLBACK] doc={document_id} status={body.get('status')} keys={list(body.keys())}", flush=True)

    token = body.get("token")
    if token:
        try:
            body = jwt.decode(token, settings.onlyoffice_jwt_secret, algorithms=["HS256"])
        except jwt.InvalidTokenError:
            print(f"[CALLBACK] doc={document_id} JWT decode FAILED", flush=True)
            return JSONResponse(content={"error": 1})

    cb_status = body.get("status")

    if cb_status in (2, 6):
        raw_url = body.get("url")
        download_url = _rewrite_onlyoffice_url(raw_url) if raw_url else None
        print(f"[CALLBACK] doc={document_id} raw_url={raw_url}", flush=True)
        print(f"[CALLBACK] doc={document_id} rewritten_url={download_url}", flush=True)
        if download_url:
            try:
                req = urllib.request.Request(download_url)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    file_content = resp.read()
                print(f"[CALLBACK] doc={document_id} downloaded {len(file_content)} bytes", flush=True)

                latest = db.execute(
                    select(VersionModel)
                    .where(VersionModel.doc_id == document_id)
                    .order_by(VersionModel.version.desc())
                ).scalars().first()

                if latest is None:
                    print(f"[CALLBACK] doc={document_id} ERROR: no versions", flush=True)
                    return JSONResponse(content={"error": 1})

                print(f"[CALLBACK] doc={document_id} updating version id={latest.id} v={latest.version}", flush=True)
                doc_row = db.get(DocumentModel, document_id)
                upload_name = word_document_upload_filename(doc_row.name if doc_row is not None else "")
                s3 = S3Repository()
                new_url = s3.upload_bytes(
                    content=file_content,
                    filename=upload_name,
                    content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                old_url = latest.s3_url
                latest.s3_url = new_url
                db.commit()
                print(f"[CALLBACK] doc={document_id} S3 OK: {old_url[:80]} -> {new_url[:80]}", flush=True)
                try:
                    s3.delete_file_by_url(old_url)
                except Exception:
                    pass
            except Exception as exc:
                print(f"[CALLBACK] doc={document_id} EXCEPTION: {exc}", flush=True)
                import traceback
                traceback.print_exc()
                return JSONResponse(content={"error": 1})
        else:
            print(f"[CALLBACK] doc={document_id} status={cb_status} but NO download_url", flush=True)

    return JSONResponse(content={"error": 0})
