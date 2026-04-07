from typing import Any, Optional
from datetime import date

from pydantic import BaseModel, Field, field_validator
from pydantic.aliases import AliasChoices


class UserLoginRequestScheme(BaseModel):
    name: str = Field(validation_alias=AliasChoices("name", "login"))


class UserResponseScheme(BaseModel):
    id: str
    name: str
    login: str
    first_name: Optional[str] = None
    second_name: Optional[str] = None
    surname: Optional[str] = None
    sex: Optional[bool] = None
    birth_date: Optional[str] = None
    department_id: Optional[str] = None
    department_title: Optional[str] = None
    position_id: Optional[str] = None
    position_name: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    is_superuser: bool = False

    @field_validator("id", mode="before")
    @classmethod
    def _id_as_str(cls, v: Any) -> str:
        if v is None:
            raise ValueError("id обязателен")
        return str(v)


class MemberResponseScheme(BaseModel):
    user_id: str
    name: str
    user_role: str

    @field_validator("user_id", mode="before")
    @classmethod
    def _user_id_as_str(cls, v: Any) -> str:
        return str(v) if v is not None else ""


class ApproverResponseScheme(BaseModel):
    user_id: str
    name: str
    approved: bool | None
    reason_for_refusal: str | None = None

    @field_validator("user_id", mode="before")
    @classmethod
    def _approver_user_id_as_str(cls, v: Any) -> str:
        return str(v) if v is not None else ""


class LoginResponseScheme(BaseModel):
    ok: bool = True

class UserDocumentRoleScheme(BaseModel):
    user_role: str | None