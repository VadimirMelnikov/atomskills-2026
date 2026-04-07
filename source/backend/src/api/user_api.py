from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette import status

from auth.auth import authx
from auth.deps import require_superuser
from database.config import get_session
from database.repositories import UserRepository
from services.user_import_service import UserImportService
from services.user_service import UserService
from schemas.users import (
    LoginResponseScheme,
    UserLoginRequestScheme,
    UserResponseScheme,
)

router = APIRouter(prefix="/users", tags=["Пользователи"])


def _excel_import_response_body(result: dict) -> dict:
    """Приводит результат UserImportService к полям, которые ожидает фронтенд."""
    errors = result.get("errors") or []
    created = int(result.get("created") or 0)
    updated = int(result.get("updated") or 0)
    skipped = int(result.get("skipped") or 0)
    imported_count = created + updated
    failed_count = len(errors)
    success = failed_count == 0

    parts: list[str] = []
    if imported_count > 0:
        parts.append(f"Создано записей: {created}, обновлено: {updated}")
    else:
        parts.append("Нет импортированных строк сотрудников")
    if skipped > 0:
        parts.append(f"Пропущено строк: {skipped}")
    if failed_count > 0:
        parts.append(f"Ошибок при разборе: {failed_count}")

    return {
        "success": success,
        "message": ". ".join(parts) if parts else "Импорт завершён",
        "importedCount": imported_count,
        "failedCount": failed_count,
    }


@router.get(
    "/",
    response_model=list[UserResponseScheme],
    dependencies=[Depends(authx.access_token_required)],
    description="Получить пользователей по имени или id",
)
def get_users(
    name: str | None = Query(default=None, description="Имя пользователя или табельный номер"),
    db: Session = Depends(get_session),
    payload = Depends(authx.access_token_required),
) -> list[UserResponseScheme]:
    return UserService(db).find_users_by_name_or_id(name)

@router.get("/me", response_model=UserResponseScheme)
def get_me(
    db: Session = Depends(get_session),
    payload = Depends(authx.access_token_required)
):
    username = payload.sub
    user = UserRepository.get_user_by_login_with_details(db, username)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    return UserRepository._to_user_response(user)


@router.post(
    "/login",
    response_model=LoginResponseScheme,
    description="Аутентификация пользователя")
def login(user: UserLoginRequestScheme, db: Session = Depends(get_session)) -> JSONResponse:
    user_model = UserRepository.get_user_by_name(db, user.name)
    if user_model is not None:
        token = authx.create_access_token(uid=user.name)
        response = JSONResponse(
            status_code=status.HTTP_200_OK,
            content=LoginResponseScheme().model_dump(),
        )
        authx.set_access_cookies(token, response)
        return response

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: JSONResponse) -> JSONResponse:
    response = JSONResponse(content={"message": "Выход выполнен успешно"})
    authx.unset_access_cookies(response)
    return response


@router.post(
    "",
    dependencies=[Depends(require_superuser)],
    description="Загрузить пользователей из Excel (.xlsx) с полной заменой старых данных",
)
def import_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
) -> JSONResponse:
    if file.filename is None or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Можно загрузить только .xlsx")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Файл пустой")

    service = UserImportService(db)
    try:
        result = service.replace_all_users_from_xlsx(content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ошибка импорта: {exc}") from exc

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=_excel_import_response_body(result),
    )
