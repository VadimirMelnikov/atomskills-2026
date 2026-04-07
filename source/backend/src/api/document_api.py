import json
import time
import urllib.request
import urllib.error

import jwt
from authx import TokenPayload
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth.auth import authx
from database.config import get_session
from database.models import (
    VersionModel,
    DocumentModel,
    UserDocumentModel,
    UserModel,
    ApproverModel,
    UserRole,
    VersionStatus,
)
from database.repositories import UserRepository, S3Repository
from schemas.documents import (
    ApproveRequestScheme,
    DocumentCardScheme,
    DocumentRequestScheme,
    DocumentResponseScheme,
    DocumentToApproveScheme,
    ToBeApprovedDocumentScheme,
    VersionResponseScheme,
    ShareDocumentRequestScheme,
)
from schemas.users import ApproverResponseScheme, MemberResponseScheme, UserDocumentRoleScheme
from services.document_service import DocumentService, word_document_upload_filename
from settings import settings

router = APIRouter(
    prefix="/document",
    tags=["Работа с документами"],
    dependencies=[Depends(authx.access_token_required)],
)


def _map_service_error(exc: ValueError) -> HTTPException:
    detail = str(exc)
    if detail.startswith("403:"):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail[4:])
    if "не найден" in detail:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _get_current_user_id(payload: TokenPayload, db: Session) -> str:
    user = UserRepository.get_user_by_login(db, payload.sub)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user.id


def _get_current_user(payload: TokenPayload, db: Session) -> UserModel:
    user = UserRepository.get_user_by_login(db, payload.sub)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    return user


def _user_document_link(db: Session, user_id: str, document_id: int) -> UserDocumentModel | None:
    return db.execute(
        select(UserDocumentModel).where(
            UserDocumentModel.user_id == user_id,
            UserDocumentModel.document_id == document_id,
        )
    ).scalars().first()


def _get_latest_version(db: Session, document_id: int) -> VersionModel | None:
    return db.execute(
        select(VersionModel)
        .where(VersionModel.doc_id == document_id)
        .order_by(VersionModel.version.desc())
    ).scalars().first()


def _run_onlyoffice_forcesave(key: str) -> dict:
    command_payload: dict = {
        "c": "forcesave",
        "key": key,
    }
    command_url = f"{settings.onlyoffice_internal_url.rstrip('/')}/coauthoring/CommandService.ashx"
    try:
        body = json.dumps(command_payload).encode("utf-8")
        req = urllib.request.Request(
            command_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            response_json = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка запроса к ONLYOFFICE CommandService: {exc}",
        ) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502, detail="ONLYOFFICE вернул невалидный JSON"
        ) from exc

    command_error = int(response_json.get("error", 1) or 1)
    if command_error not in {0, 1, 4}:
        raise HTTPException(
            status_code=502,
            detail=f"ONLYOFFICE force-save error: {response_json}",
        )
    return response_json


def _user_display_name(user: UserModel) -> str:
    """ФИО для ONLYOFFICE (как в UserRepository._to_user_response); если полей нет — логин."""
    parts = [user.surname, user.first_name, user.second_name]
    return " ".join(filter(None, parts)) or user.login


_COMMENT_AUTHOR_ONLY_PERMISSIONS = {
    "deleteCommentAuthorOnly": True,
    "editCommentAuthorOnly": True,
    "protect": False,
    "review": False,
}

SHARED_DOCUMENT_NAME = "Общий документ"


def _can_force_save(db: Session, user: UserModel, doc: DocumentModel) -> bool:
    # Сохранять (через ONLYOFFICE forcesave) может только владелец или роль `writer`.
    if doc.owner_id == user.id:
        return True

    link = _user_document_link(db, user.id, doc.id)
    if link is None:
        return False

    return link.user_role == UserRole.writer


def _ensure_shared_document_demo_acl(db: Session, document_id: int) -> None:
    """Связка демо-пользователей с общим документом (роли в user_document)."""
    pairs = [
        ("Вадим", UserRole.reader),
        ("Максим", UserRole.commenter),
        ("Андрей", UserRole.writer),
    ]
    for login, role in pairs:
        u = UserRepository.get_user_by_login(db, login)
        if u is None:
            continue
        if _user_document_link(db, u.id, document_id) is not None:
            continue
        db.add(UserDocumentModel(user_id=u.id, document_id=document_id, user_role=role))


@router.post(
    "",
    response_model=DocumentResponseScheme,
    status_code=status.HTTP_201_CREATED,
    description="Создать пустой документ",
)
def create_document(
    request: DocumentRequestScheme,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> DocumentResponseScheme:
    service = DocumentService(db)
    owner_id = _get_current_user_id(payload, db)
    try:
        return service.create_document(request.name, owner_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.put(
    "",
    response_model=DocumentResponseScheme,
    status_code=status.HTTP_201_CREATED,
    description="Загрузить документ и создать Document + Version(1)",
)
def import_document(
    file: UploadFile = File(...),
    request: DocumentRequestScheme = Depends(DocumentRequestScheme.as_form),
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> DocumentResponseScheme:
    service = DocumentService(db)
    owner_id = _get_current_user_id(payload, db)
    try:
        return service.import_document(request.name, owner_id, file)
    except ValueError as exc:
        raise _map_service_error(exc) from exc

# api/document/{doc_id}?version=1
@router.get(
    "/{doc_id}",
    # response_model=VersionResponseScheme,  # убираем, т.к. возвращаем конфиг ONLYOFFICE
    description="Получить конфиг редактора ONLYOFFICE для указанной версии документа",
)
def get_editor_config(
    doc_id: int,
    version: int | None = Query(None, description="Номер версии (если не указано - последняя)"),
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> dict:
    """Возвращает конфигурацию редактора ONLYOFFICE для документа с учётом ролей на основе статуса версии."""
    user = UserRepository.get_user_by_login(db, payload.sub)
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    doc = db.get(DocumentModel, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Документ не найден")

    # Определяем запрошенную версию
    if version is None:
        # Берём последнюю версию
        version_obj = db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == doc_id)
            .order_by(VersionModel.version.desc())
        ).scalars().first()
    else:
        version_obj = db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == doc_id, VersionModel.version == version)
        ).scalars().first()

    if version_obj is None:
        raise HTTPException(status_code=404, detail="Версия не найдена")

    # Логика определения роли на основе статуса версии и таблицы approvers
    def determine_user_role() -> UserRole:
        # Базовая роль из user_document (если есть).
        # ВАЖНО: отсутствие записи НЕ должно трактоваться как `writer` (это приводило к обходу прав).
        link = db.execute(
            select(UserDocumentModel)
            .where(
                UserDocumentModel.user_id == user.id,
                UserDocumentModel.document_id == doc_id,
            )
        ).scalars().first()
        base_role = link.user_role if link else None

        # Пользователь может иметь доступ к документу не только через user_document,
        # но и как согласующий (ApproverModel) для конкретной версии.
        approver = db.execute(
            select(ApproverModel)
            .where(
                ApproverModel.version_id == version_obj.id,
                ApproverModel.user_id == user.id,
            )
        ).scalars().first()

        if doc.owner_id != user.id and link is None and approver is None:
            if version_obj.status == VersionStatus.approved:
                return UserRole.reader
            raise HTTPException(status_code=403, detail="Недостаточно прав для доступа к документу")


        print(f"doc.owner_id: {doc.owner_id}, user.id: {user.id}, link: {link}, approver: {approver}")
        if doc.owner_id != user.id and link is None and approver is None:
            raise HTTPException(status_code=403, detail="Недостаточно прав для доступа к документу")

        # Для владельца всегда считаем роль `writer`, даже если связи в user_document нет.
        if doc.owner_id == user.id:
            base_role = UserRole.writer

        if base_role is None:
            base_role = UserRole.reader

        # Если статус версии approved или refusal -> всегда reader
        if version_obj.status in (VersionStatus.approved, VersionStatus.refusal):
            return UserRole.reader

        # Если under_approval
        if version_obj.status == VersionStatus.under_approval:
            if approver is not None:
                return UserRole.commenter
            else:
                # Пользователь не аппрувер
                if base_role == UserRole.reader:
                    return UserRole.reader
                else:
                    # commenter или writer -> commenter (т.к. under_approval, но не аппрувер)
                    return UserRole.commenter

        # Иначе (статус draft) смотрим на базовую роль
        return base_role

    user_role = determine_user_role()

    if user_role == UserRole.reader:
        editor_mode = "view"
        doc_permissions = {"edit": False, "protect": False, "review": False}
    elif user_role == UserRole.commenter:
        editor_mode = "edit"
        doc_permissions = {
            "edit": False,
            "comment": True,
            "fillForms": False,
            **_COMMENT_AUTHOR_ONLY_PERMISSIONS,
        }
    else:  # writer
        editor_mode = "edit"
        doc_permissions = dict(_COMMENT_AUTHOR_ONLY_PERMISSIONS)

    base = settings.onlyoffice_internal_callback_base_url
    callback_url = f"{base}/api/onlyoffice/callback/{doc_id}"
    doc_url = f"{base}/api/onlyoffice/download/{version_obj.id}"

    key = f"doc-{doc_id}-v{version_obj.version}"
    title = word_document_upload_filename(doc.name)

    document_block: dict = {
        "title": title,
        "url": doc_url,
        "fileType": "docx",
        "key": key,
    }
    if doc_permissions is not None:
        document_block["permissions"] = doc_permissions

    editor_config: dict = {
        "mode": editor_mode,
        "callbackUrl": callback_url,
        "user": {
            "id": str(user.id),
            "name": _user_display_name(user),
        },
        "customization": {
            "forcesave": False,
        },
    }
    # Fast: курсоры и подсказки с именами в реальном времени. Strict скрывает чужие правки до синхронизации.
    # change=False — нельзя переключить Strict в UI (иначе выбор сохраняется в localStorage и ломает поведение).
    if editor_mode == "edit":
        editor_config["coEditing"] = {"mode": "fast", "change": False}

    config = {
        "documentType": "word",
        "document": document_block,
        "editorConfig": editor_config,
        "is_owner": doc.owner_id == user.id,
    }
    return config


@router.get(
    "/{doc_id}/compare-config",
    description="Конфиг редактора для сравнения двух версий (отдельный экземпляр, без co-editing)",
)
def get_compare_editor_config(
    doc_id: int,
    base_version_id: int = Query(..., description="ID старой версии (открывается в редакторе)"),
    editor_key: str | None = Query(None, description="Ключ текущей сессии редактора ONLYOFFICE для force-save перед сравнением"),
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> dict:
    user = UserRepository.get_user_by_login(db, payload.sub)
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    doc = db.get(DocumentModel, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Документ не найден")

    base_ver = db.get(VersionModel, base_version_id)
    if base_ver is None or base_ver.doc_id != doc_id:
        raise HTTPException(status_code=404, detail="Базовая версия не найдена")

    if _can_force_save(db, user, doc):
        latest_before_compare = _get_latest_version(db, doc_id)
        if latest_before_compare is not None:
            save_key = editor_key or f"doc-{doc.id}-v{latest_before_compare.version}"
            _run_onlyoffice_forcesave(save_key)
            db.expire_all()

    latest = _get_latest_version(db, doc_id)
    if latest is None:
        raise HTTPException(status_code=404, detail="У документа нет версий")

    base = settings.onlyoffice_internal_callback_base_url
    unique_key = f"compare-{doc_id}-v{base_ver.version}-{int(time.time())}"

    title = word_document_upload_filename(doc.name)

    return {
        "config": {
            "documentType": "word",
            "document": {
                "title": f"{title} (v{base_ver.version} → v{latest.version})",
                "url": f"{base}/api/onlyoffice/download/{base_ver.id}",
                "fileType": "docx",
                "key": unique_key,
                "permissions": {
                    "edit": False,
                    "comment": False,
                    "review": False,
                    "download": True,
                    "print": True,
                    "copy": True,
                    "protect": False,
                },
            },
            "editorConfig": {
                "mode": "edit",
                "user": {"id": str(user.id), "name": _user_display_name(user)},
                "customization": {
                    "forcesave": False,
                    "compactHeader": True,
                    "toolbarNoTabs": True,
                },
            },
        },
        "compareFileUrl": f"{base}/api/onlyoffice/download/{latest.id}",
    }


@router.get(
    "",
    response_model=list[DocumentCardScheme | DocumentToApproveScheme],
    description="Получить карточки документов по типу",
)
def get_documents(
    type: str = Query(..., description="public | my_docs | shared | to_be_approved"),
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> list[DocumentCardScheme] | list[DocumentToApproveScheme]:
    service = DocumentService(db)
    user_id = _get_current_user_id(payload, db)
    try:
        return service.get_documents(type, user_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.get(
    "/{doc_id}/versions",
    response_model=list[VersionResponseScheme],
    description="Получить все версии документа",
)
def get_document_versions(doc_id: int, db: Session = Depends(get_session)) -> list[VersionResponseScheme]:
    service = DocumentService(db)
    try:
        return service.get_document_versions(doc_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.get(
    "/{doc_id}/members",
    response_model=list[MemberResponseScheme],
    description="Получить всех соавторов документа",
)
def get_document_members(doc_id: int, db: Session = Depends(get_session)) -> list[MemberResponseScheme]:
    service = DocumentService(db)
    try:
        return service.get_document_members(doc_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.get(
    "/{doc_id}/approvers",
    response_model=list[ApproverResponseScheme],
    description="Получить всех аппруверов текущей версии",
)
def get_document_approvers(doc_id: int, db: Session = Depends(get_session)) -> list[ApproverResponseScheme]:
    service = DocumentService(db)
    try:
        return service.get_document_approvers(doc_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.get(
    "/{doc_id}/{user_id}",
    response_model=UserDocumentRoleScheme,
    description="Роль пользователя по отношению к документу",
)
def get_user_document_role(
    doc_id: int,
    user_id: str,
    db: Session = Depends(get_session),
) -> UserDocumentRoleScheme:
    service = DocumentService(db)
    try:
        return service.get_user_document_role(user_id, doc_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.post(
    "/{doc_id}/move_to_approval",
    status_code=status.HTTP_200_OK,
    description="Отправить документ на согласование (для последней версии)",
)
def move_document_to_approval(
    doc_id: int,
    request: ToBeApprovedDocumentScheme,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> None:
    service = DocumentService(db)
    user_id = _get_current_user_id(payload, db)
    try:
        service.move_document_to_approval(doc_id, user_id, request)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


def _get_latest_version_id_or_404(db: Session, doc_id: int) -> int:
    v = db.execute(
        select(VersionModel).where(VersionModel.doc_id == doc_id).order_by(VersionModel.version.desc())
    ).scalars().first()
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="У документа нет версий")
    return v.id


@router.post(
    "/{doc_id}/approve",
    status_code=status.HTTP_200_OK,
    description="Аппрувнуть/отклонить документ (для последней версии)",
)
def approve_document(
    doc_id: int,
    request: ApproveRequestScheme,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> None:
    service = DocumentService(db)
    user_id = _get_current_user_id(payload, db)
    version_id = _get_latest_version_id_or_404(db, doc_id)
    try:
        service.approve_document(version_id, user_id, request)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.post(
    "/{doc_id}/version_legacy",
    response_model=VersionResponseScheme,
    status_code=status.HTTP_201_CREATED,
    description="Создать новую версию документа",
)
def create_new_version_legacy(doc_id: int, db: Session = Depends(get_session)) -> VersionResponseScheme:
    # NOTE: endpoint должен проверять права, иначе любой может создать новую версию по `doc_id`.
    raise RuntimeError("create_new_version signature mismatch; should be patched below")


@router.post(
    "/{doc_id}/version",
    response_model=VersionResponseScheme,
    status_code=status.HTTP_201_CREATED,
    description="Создать новую версию документа",
)
def create_new_version(
    doc_id: int,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> VersionResponseScheme:
    service = DocumentService(db)
    user = _get_current_user(payload, db)
    doc = db.get(DocumentModel, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if not _can_force_save(db, user, doc):
        raise HTTPException(status_code=403, detail="Недостаточно прав для создания новой версии")

    try:
        return service.update_document_version(doc_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.post(
    "/{doc_id}/share",
)
def share_document(
    doc_id: int,
    request: ShareDocumentRequestScheme,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> None:
    service = DocumentService(db)
    actor_id = _get_current_user_id(payload, db)
    try:
        service.add_document_member(doc_id, actor_id, request)
    except ValueError as exc:
        raise _map_service_error(exc) from exc

@router.delete(
    "/{doc_id}/share/{user_id}",
)
def unshare_document(
    doc_id: int,
    user_id: str,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> None:
    service = DocumentService(db)
    actor_id = _get_current_user_id(payload, db)
    try:
        service.remove_document_member(doc_id, actor_id, user_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc

@router.patch(
    "/{doc_id}/share",
)
def update_document_member(
    doc_id: int,
    request: ShareDocumentRequestScheme,
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> None:
    service = DocumentService(db)
    actor_id = _get_current_user_id(payload, db)
    try:
        service.update_document_member(doc_id, actor_id, request)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.post(
    "/shared",
    description="Получить (или создать) общий документ для совместного редактирования",
)
def get_or_create_shared_document(
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> dict:
    doc = db.execute(
        select(DocumentModel).where(DocumentModel.name == SHARED_DOCUMENT_NAME)
    ).scalars().first()

    if doc is None:
        service = DocumentService(db)
        owner_id = _get_current_user_id(payload, db)
        result = service.create_document(SHARED_DOCUMENT_NAME, owner_id)
        doc = db.get(DocumentModel, result.id)

    _ensure_shared_document_demo_acl(db, doc.id)
    db.commit()

    return {"document_id": doc.id}


@router.post(
    "/{doc_id}/force-save",
    description="Принудительно сохранить текущую версию через ONLYOFFICE CommandService",
)
def force_save_document(
    doc_id: int,
    editor_key: str | None = Query(None, description="Ключ сессии редактора ONLYOFFICE (если не указан — берётся из последней версии)"),
    db: Session = Depends(get_session),
    payload: TokenPayload = Depends(authx.access_token_required),
) -> JSONResponse:
    user = _get_current_user(payload, db)

    doc = db.get(DocumentModel, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Документ не найден")

    if not _can_force_save(db, user, doc):
        raise HTTPException(status_code=403, detail="Недостаточно прав для сохранения версии")

    latest = _get_latest_version(db, doc.id)
    if latest is None:
        raise HTTPException(status_code=500, detail="У документа нет версий")

    key = editor_key or f"doc-{doc.id}-v{latest.version}"
    response_json = _run_onlyoffice_forcesave(key)
    command_error = int(response_json.get("error", 1) or 1)

    return JSONResponse(
        content={"ok": True, "onlyoffice": response_json, "force_save_status": command_error}
    )