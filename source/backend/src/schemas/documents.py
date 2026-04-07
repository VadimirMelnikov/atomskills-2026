from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from fastapi import Form

from database.models import ApproveMethod, UserRole


class DocumentRequestScheme(BaseModel):
    name: str

    @classmethod
    def as_form(cls, name: str = Form(...)) -> "DocumentRequestScheme":
        return cls(name=name)


class DocumentResponseScheme(BaseModel):
    id: int
    name: str


class DocumentCardScheme(BaseModel):
    id: int
    name: str
    owner_id: Optional[str] = None  # ✅ Добавляем owner_id
    status: Optional[str] = None     # ✅ Добавляем статус последней версии
    # Нужен для корректного выбора модели в union-типа ответа (см. get_documents для to_be_approved)
    model_config = {"extra": "forbid"}


class DocumentToApproveScheme(BaseModel):
    id: int
    name: str
    version: int
    version_id: int  # PK versions — уникален для каждой строки списка на согласовании
    status: str
    approved: bool | None = None
    owner_id: Optional[str] = None  # ✅ Добавляем owner_id


class VersionRefusalEntryScheme(BaseModel):
    """Кто отказал и с какой формулировкой (для отображения всем, кто открывает документ)."""

    reviewer_name: str
    reason: str | None = None


class VersionResponseScheme(BaseModel):
    id: int
    version: int
    status: str
    s3_url: str
    created_at: datetime
    refusal_entries: list[VersionRefusalEntryScheme] | None = None


class ToBeApprovedDocumentScheme(BaseModel):
    approve_method: ApproveMethod
    approvers: list[str]


class ApproveRequestScheme(BaseModel):
    approved: bool
    reason_for_refusal: str | None = None


class ShareDocumentRequestScheme(BaseModel):
    user_id: str
    user_role: UserRole