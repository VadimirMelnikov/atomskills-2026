from authx import TokenPayload
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from starlette import status

from auth.auth import authx
from database.config import get_session
from database.models import UserModel
from database.repositories import UserRepository


def require_superuser(
    payload: TokenPayload = Depends(authx.access_token_required),
    db: Session = Depends(get_session),
) -> UserModel:
    user = UserRepository.get_user_by_login(db, payload.sub)
    if user is None or not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    return user
