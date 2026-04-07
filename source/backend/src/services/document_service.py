from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import String, cast, delete, select, update
from sqlalchemy.orm import Session

from database.models import ApproveMethod, ApproverModel, DocumentModel, UserRole, VersionStatus, UserDocumentModel, UserModel, VersionModel
from database.repositories import S3Repository
from schemas.documents import (
    ApproveRequestScheme,
    DocumentCardScheme,
    DocumentResponseScheme,
    DocumentToApproveScheme,
    ToBeApprovedDocumentScheme,
    VersionRefusalEntryScheme,
    VersionResponseScheme,
    ShareDocumentRequestScheme,
)
from schemas.users import UserResponseScheme, MemberResponseScheme, ApproverResponseScheme, UserDocumentRoleScheme


def word_document_upload_filename(document_name: str) -> str:
    n = (document_name or "").strip() or "document"
    return n if n.lower().endswith(".docx") else f"{n}.docx"


class DocumentService:
    def __init__(self, db: Session):
        self.db = db
        self._s3_repository = S3Repository()

    @staticmethod
    def _to_document_scheme(document: DocumentModel) -> DocumentResponseScheme:
        return DocumentResponseScheme(id=document.id, name=document.name)

    @staticmethod
    def _to_version_scheme(version: VersionModel) -> VersionResponseScheme:
        return VersionResponseScheme(
            id=version.id,
            version=version.version,
            status=version.status.value if hasattr(version.status, "value") else str(version.status),
            s3_url=version.s3_url,
            created_at=version.created_at,
            refusal_entries=None,
        )

    def _refusal_entries_for_version(self, version_id: int) -> list[VersionRefusalEntryScheme]:
        rows = self.db.execute(
            select(ApproverModel, UserModel)
            .join(UserModel, UserModel.id == ApproverModel.user_id)
            .where(
                ApproverModel.version_id == version_id,
                ApproverModel.approved.is_(False),
            )
            .order_by(ApproverModel.order_index)
        ).all()
        result: list[VersionRefusalEntryScheme] = []
        for approver, user in rows:
            display = " ".join(filter(None, [user.first_name, user.second_name, user.surname])).strip()
            if not display:
                display = user.login or approver.user_id
            result.append(
                VersionRefusalEntryScheme(
                    reviewer_name=display,
                    reason=approver.reason_for_refusal,
                )
            )
        return result

    def _to_version_scheme_with_refusal(self, version: VersionModel) -> VersionResponseScheme:
        base = self._to_version_scheme(version)
        if version.status != VersionStatus.refusal:
            return base
        entries = self._refusal_entries_for_version(version.id)
        return base.model_copy(update={"refusal_entries": entries})

    def _get_document_or_raise(self, document_id: int) -> DocumentModel:
        document = self.db.get(DocumentModel, document_id)
        if document is None:
            raise ValueError(f"Документ с id={document_id} не найден")
        return document

    def get_documents(self, doc_type: str, user_id: str) -> list[DocumentCardScheme] | list[DocumentToApproveScheme]:
        if doc_type == "public":
            documents = self.db.execute(
                select(DocumentModel)
                .join(VersionModel, VersionModel.doc_id == DocumentModel.id)
                .where(VersionModel.status == VersionStatus.approved)
                .order_by(DocumentModel.id)
            ).scalars().unique().all()
            
            # Получаем статус для каждого документа
            result = []
            for doc in documents:
                # Получаем последнюю версию для статуса
                latest_version = self.db.execute(
                    select(VersionModel)
                    .where(VersionModel.doc_id == doc.id)
                    .order_by(VersionModel.version.desc())
                ).scalars().first()
                
                result.append(DocumentCardScheme(
                    id=doc.id,
                    name=doc.name,
                    owner_id=doc.owner_id,
                    status=latest_version.status.value if latest_version else None
                ))
            return result
            
        elif doc_type == "my_docs":
            documents = self.db.execute(
                select(DocumentModel)
                .where(DocumentModel.owner_id == user_id)
                .order_by(DocumentModel.id)
            ).scalars().all()
            
            result = []
            for doc in documents:
                # Получаем последнюю версию для статуса
                latest_version = self.db.execute(
                    select(VersionModel)
                    .where(VersionModel.doc_id == doc.id)
                    .order_by(VersionModel.version.desc())
                ).scalars().first()
                
                result.append(DocumentCardScheme(
                    id=doc.id,
                    name=doc.name,
                    owner_id=doc.owner_id,
                    status=latest_version.status.value if latest_version else None
                ))
            return result
            
        elif doc_type == "shared":
            documents = self.db.execute(
                select(DocumentModel)
                .join(UserDocumentModel, UserDocumentModel.document_id == DocumentModel.id)
                .where(UserDocumentModel.user_id == user_id, DocumentModel.owner_id != user_id)
                .order_by(DocumentModel.id)
            ).scalars().all()
            
            result = []
            for doc in documents:
                # Получаем последнюю версию для статуса
                latest_version = self.db.execute(
                    select(VersionModel)
                    .where(VersionModel.doc_id == doc.id)
                    .order_by(VersionModel.version.desc())
                ).scalars().first()
                
                result.append(DocumentCardScheme(
                    id=doc.id,
                    name=doc.name,
                    owner_id=doc.owner_id,
                    status=latest_version.status.value if latest_version else None
                ))
            return result
            
        elif doc_type == "to_be_approved":
            rows = self.db.execute(
                select(ApproverModel, VersionModel, DocumentModel)
                .join(VersionModel, VersionModel.id == ApproverModel.version_id)
                .join(DocumentModel, DocumentModel.id == VersionModel.doc_id)
                .where(ApproverModel.user_id == user_id)
                .order_by(DocumentModel.id, VersionModel.version.desc(), ApproverModel.order_index)
            ).all()

            return [
                DocumentToApproveScheme(
                    id=document.id,
                    name=document.name,
                    version=version.version,
                    version_id=version.id,
                    status=version.status.value if hasattr(version.status, "value") else str(version.status),
                    approved=approver.approved,
                    owner_id=document.owner_id,  # ✅ Добавляем owner_id
                )
                for approver, version, document in rows
            ]
        else:
            raise ValueError(f"Неизвестный тип документов: {doc_type}")

    def create_document(self, name: str, owner_id: str) -> DocumentResponseScheme:  # ← str вместо int
        document = DocumentModel(name=name, owner_id=owner_id)
        self.db.add(document)
        self.db.flush()

        template_path = Path(__file__).resolve().parents[1] / "template.docx"
        with template_path.open("rb") as template_file:
            template_upload = UploadFile(
                filename=word_document_upload_filename(name),
                file=template_file,
            )
            s3_url = self._s3_repository.upload_file(template_upload)
        first_version = VersionModel(
            version=1,
            status=VersionStatus.draft,
            approve_method=ApproveMethod.simple,
            s3_url=s3_url,
            doc_id=document.id,
        )
        self.db.add(first_version)

        self.db.commit()
        self.db.refresh(document)
        return self._to_document_scheme(document)

    def import_document(self, name: str, owner_id: str, doc: UploadFile) -> DocumentResponseScheme:  # ← str вместо int
        document = DocumentModel(name=name, owner_id=owner_id)
        self.db.add(document)
        self.db.flush()

        s3_url = self._s3_repository.upload_file(doc)
        first_version = VersionModel(
            version=1,
            status=VersionStatus.draft,
            approve_method=ApproveMethod.simple,
            s3_url=s3_url,
            doc_id=document.id,
        )
        self.db.add(first_version)

        self.db.commit()
        self.db.refresh(document)
        return self._to_document_scheme(document)

    def update_document(self, document_id: int, doc: UploadFile) -> None:
        self._get_document_or_raise(document_id)
        latest_version = self.db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == document_id)
            .order_by(VersionModel.version.desc())
        ).scalars().first()
        if latest_version is None:
            raise ValueError(f"У документа id={document_id} отсутствуют версии")

        new_s3_url = self._s3_repository.upload_file(doc)
        self._s3_repository.delete_file_by_url(latest_version.s3_url)
        latest_version.s3_url = new_s3_url
        self.db.commit()

    def update_document_version(self, document_id: int) -> VersionResponseScheme:
        self._get_document_or_raise(document_id)
        latest_version = self.db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == document_id)
            .order_by(VersionModel.version.desc())
        ).scalars().first()
        if latest_version is None:
            raise ValueError(f"У документа id={document_id} отсутствуют версии")

        copied_s3_url = self._s3_repository.copy_file_by_url(latest_version.s3_url)
        new_version = VersionModel(
            version=latest_version.version + 1,
            status=VersionStatus.draft,
            approve_method=ApproveMethod.simple,
            s3_url=copied_s3_url,
            doc_id=document_id,
        )
        self.db.add(new_version)
        self.db.commit()
        self.db.refresh(new_version)
        return self._to_version_scheme(new_version)

    def get_document(self, document_id: int, version: int):
        # todo продумать обращение к document server
        pass

    def get_document_versions(self, document_id: int) -> list[VersionResponseScheme]:
        self._get_document_or_raise(document_id)
        versions = self.db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == document_id)
            .order_by(VersionModel.version)
        ).scalars().all()
        return [self._to_version_scheme_with_refusal(version) for version in versions]

    def get_document_members(self, document_id: int) -> list[MemberResponseScheme]:
        self._get_document_or_raise(document_id)
        rows = self.db.execute(
            select(UserDocumentModel, UserModel)
            .join(UserModel, UserModel.id == UserDocumentModel.user_id)
            .where(UserDocumentModel.document_id == document_id)
            .order_by(UserModel.id)
        ).all()
        return [
            MemberResponseScheme(
                user_id=user.id,
                name=" ".join(filter(None, [user.first_name, user.second_name, user.surname])),
                user_role=link.user_role.value,
            )
            for link, user in rows
        ]

    def get_document_approvers(self, document_id: int) -> list[ApproverResponseScheme]:
        self._get_document_or_raise(document_id)
        latest_version = self.db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == document_id)
            .order_by(VersionModel.version.desc())
        ).scalars().first()

        rows = self.db.execute(
            select(ApproverModel, UserModel)
            .join(UserModel, UserModel.id == ApproverModel.user_id)
            .where(ApproverModel.version_id == latest_version.id)
            .order_by(UserModel.id)
        ).all()
        return [
            ApproverResponseScheme(
                user_id=user.id,
                name=" ".join(filter(None, [user.first_name, user.second_name, user.surname])),
                approved=approver.approved,
                reason_for_refusal=approver.reason_for_refusal,
            )
            for approver, user in rows
        ]


    def move_document_to_approval(self, document_id: int, user_id: str, request: ToBeApprovedDocumentScheme) -> None:
        document = self._get_document_or_raise(document_id)
        # Владелец документа имеет право отправить документ на согласование
        if document.owner_id != user_id:
            access_link = self.db.execute(
                select(UserDocumentModel).where(
                    UserDocumentModel.document_id == document_id,
                    UserDocumentModel.user_id == user_id,
                )
            ).scalars().first()
            if access_link is None or access_link.user_role != UserRole.writer:
                raise ValueError(" Нет прав для данного действия")

        latest_version = self.db.execute(
            select(VersionModel)
            .where(VersionModel.doc_id == document_id)
            .order_by(VersionModel.version.desc())
        ).scalars().first()

        if latest_version.status != VersionStatus.draft:
            raise ValueError(
                "Согласующих можно назначить только для версии со статусом «Черновик»",
            )

        latest_version.approve_method = request.approve_method
        latest_version.status = VersionStatus.under_approval

        self.db.add_all(
            [
                ApproverModel(
                    user_id=approver_user_id,
                    version_id=latest_version.id,
                    order_index=idx,
                    approved=None,
                    reason_for_refusal=None,
                )
                for idx, approver_user_id in enumerate(request.approvers)
            ]
        )
        self.db.commit()
    
    def approve_document(self, version_id: int, user_id: str, request: ApproveRequestScheme) -> None:
        version = self.db.get(VersionModel, version_id)
        if version is None:
            raise ValueError(f"Версия с id={version_id} не найдена")

        approvers = self.db.execute(
            select(ApproverModel)
            .where(ApproverModel.version_id == version_id)
            .order_by(ApproverModel.order_index)
        ).scalars().all()

        approver_row = next((a for a in approvers if a.user_id == user_id), None)
        if approver_row is None:
            raise ValueError("Вы не назначены согласующим по этой версии документа")

        if version.approve_method == ApproveMethod.strict:
            previous_not_approved = [
                a for a in approvers if a.order_index < approver_row.order_index and a.approved is not True
            ]
            if previous_not_approved:
                raise ValueError("Нельзя аппрувить: предыдущие аппруверы ещё не одобрили")

        if request.approved is False:
            reason = (request.reason_for_refusal or "").strip()
            if not reason:
                raise ValueError("Укажите причину отказа")

        approver_row.approved = request.approved
        if request.reason_for_refusal is not None:
            approver_row.reason_for_refusal = request.reason_for_refusal.strip() if request.reason_for_refusal else None

        if request.approved is False:
            version.status = VersionStatus.refusal
        else:
            all_approved = all(a.user_id == user_id and request.approved is True or a.approved is True for a in approvers)
            if all_approved:
                version.status = VersionStatus.approved

        self.db.commit()

    def _ensure_document_owner(self, document_id: int, actor_user_id: str) -> DocumentModel:
        document = self._get_document_or_raise(document_id)
        if document.owner_id != actor_user_id:
            raise ValueError("403:Только владелец документа может изменять права доступа")
        return document

    def add_document_member(self, document_id: int, actor_user_id: str, request: ShareDocumentRequestScheme) -> None:
        self._ensure_document_owner(document_id, actor_user_id)
        self.db.add(UserDocumentModel(document_id=document_id, user_id=request.user_id, user_role=request.user_role))
        self.db.commit()

    def remove_document_member(self, document_id: int, actor_user_id: str, user_id: str) -> None:
        self._ensure_document_owner(document_id, actor_user_id)
        access_link = self.db.execute(
            select(UserDocumentModel).where(
                UserDocumentModel.document_id == document_id,
                UserDocumentModel.user_id == user_id,
            )
        ).scalars().first()
        if access_link is None:
            raise ValueError("Пользователь не имеет доступа к указанному документу")

        self.db.execute(
            delete(UserDocumentModel).where(
                UserDocumentModel.document_id == document_id,
                UserDocumentModel.user_id == user_id,
            )
        )
        self.db.commit()

    def update_document_member(self, document_id: int, actor_user_id: str, request: ShareDocumentRequestScheme) -> None:
        self._ensure_document_owner(document_id, actor_user_id)
        access_link = self.db.execute(
            select(UserDocumentModel).where(
                UserDocumentModel.document_id == document_id,
                UserDocumentModel.user_id == request.user_id,
            )
        ).scalars().first()
        if access_link is None:
            raise ValueError("Пользователь не имеет доступа к указанному документу")

        self.db.execute(
            update(UserDocumentModel)
            .where(
                UserDocumentModel.document_id == document_id,
                UserDocumentModel.user_id == request.user_id,
            )
            .values(user_role=request.user_role)
        )
        self.db.commit()

    def get_user_document_role(self, user_id: str, doc_id: int) -> UserDocumentRoleScheme:
        document = self._get_document_or_raise(doc_id)
        if document.owner_id == user_id:
            return UserDocumentRoleScheme(user_role="owner")
        link = self.db.execute(
            select(UserDocumentModel).where(
                UserDocumentModel.document_id == doc_id,
                UserDocumentModel.user_id == user_id,
            )
        ).scalars().first()
        if link is not None:
            role_str = link.user_role.value if link.user_role is not None else None
            return UserDocumentRoleScheme(user_role=role_str)
        approver_row = self.db.execute(
            select(ApproverModel.user_id)
            .join(VersionModel, VersionModel.id == ApproverModel.version_id)
            .where(VersionModel.doc_id == doc_id, ApproverModel.user_id == user_id)
            .limit(1)
        ).first()
        if approver_row is not None:
            return UserDocumentRoleScheme(user_role="approver")
        return UserDocumentRoleScheme(user_role=None)