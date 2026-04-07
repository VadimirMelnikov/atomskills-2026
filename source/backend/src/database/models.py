from __future__ import annotations

from enum import Enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from database.config import Base


class UserRole(str, Enum):
    reader = "reader"
    commenter = "commenter"
    writer = "writer"


class VersionStatus(str, Enum):
    draft = "draft"
    under_approval = "under_approval"
    approved = "approved"
    refusal = "refusal"


class ApproveMethod(str, Enum):
    simple = "simple"
    strict = "strict"


class DepartmentModel(Base):
    __tablename__ = "departments"

    id = Column(String(255), primary_key=True)
    department_title = Column(String(255), nullable=False, unique=True)

    users = relationship("UserModel", back_populates="department")


class PositionModel(Base):
    __tablename__ = "positions"

    short_name = Column(String(255), primary_key=True)
    full_name = Column(String(255), nullable=False)

    users = relationship("UserModel", back_populates="position")


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_full_name", func.lower("first_name"), func.lower("second_name"), func.lower("surname")),
    )

    id = Column(String(255), primary_key=True)
    login = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(255), nullable=True)
    second_name = Column(String(255), nullable=True)
    surname = Column(String(255), nullable=True)
    sex = Column(Boolean, nullable=True)
    birth_date = Column(Date, nullable=True)
    department_id = Column(String(255), ForeignKey("departments.id"), nullable=True)
    position_id = Column(String(255), ForeignKey("positions.short_name"), nullable=True)
    manager_id = Column(String(255), ForeignKey("users.id"), nullable=True)
    is_superuser = Column(Boolean, nullable=False, server_default="false")

    department = relationship("DepartmentModel", back_populates="users")
    position = relationship("PositionModel", back_populates="users")
    manager = relationship("UserModel", remote_side=[id], backref="subordinates")

    owned_documents = relationship("DocumentModel", back_populates="owner")
    document_links = relationship("UserDocumentModel", back_populates="user")


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(String(255), ForeignKey("users.id"), nullable=False)

    owner = relationship("UserModel", back_populates="owned_documents")
    user_links = relationship("UserDocumentModel", back_populates="document")
    versions = relationship("VersionModel", back_populates="document")


class UserDocumentModel(Base):
    __tablename__ = "user_document"

    user_id = Column(String(255), ForeignKey("users.id"), primary_key=True)
    document_id = Column(BigInteger, ForeignKey("documents.id"), primary_key=True)
    user_role = Column(SqlEnum(UserRole, name="user_role"), nullable=True)

    user = relationship("UserModel", back_populates="document_links")
    document = relationship("DocumentModel", back_populates="user_links")


class VersionModel(Base):
    __tablename__ = "versions"

    id = Column(BigInteger, primary_key=True)
    version = Column(Integer, nullable=False)
    status = Column(SqlEnum(VersionStatus, name="document_status"), nullable=False)
    approve_method = Column(SqlEnum(ApproveMethod, name="approve_method"), nullable=False, server_default="simple")
    s3_url = Column(String(1024), nullable=False)
    doc_id = Column(BigInteger, ForeignKey("documents.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())

    document = relationship("DocumentModel", back_populates="versions")
    approvers = relationship("ApproverModel", back_populates="version")


class ApproverModel(Base):
    __tablename__ = "approvers"

    user_id = Column(String(255), ForeignKey("users.id"), primary_key=True)
    version_id = Column(BigInteger, ForeignKey("versions.id"), primary_key=True)
    order_index = Column(Integer, nullable=False)
    approved = Column(Boolean, nullable=True)
    reason_for_refusal = Column(Text, nullable=True)

    user = relationship("UserModel")
    version = relationship("VersionModel", back_populates="approvers")

