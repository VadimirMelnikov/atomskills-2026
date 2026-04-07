import json
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from sqlalchemy import String, cast, or_, select, func
from sqlalchemy.orm import Session, joinedload

from database.models import UserModel
from schemas.users import UserResponseScheme
from settings import settings


class UserRepository:

    @classmethod
    def get_users(cls, db: Session) -> list[UserResponseScheme]:
        """Базовый метод - только id и login"""
        rows = db.execute(select(UserModel.id, UserModel.login).order_by(UserModel.id)).all()
        return [UserResponseScheme(id=row.id, name=row.login) for row in rows]

    @classmethod
    def get_users_with_details(cls, db: Session) -> list[UserResponseScheme]:
        """Получить всех пользователей с полными данными"""
        users = db.query(UserModel).options(
            joinedload(UserModel.department),
            joinedload(UserModel.position),
            joinedload(UserModel.manager)
        ).order_by(UserModel.id).all()
        
        return [cls._to_user_response(user) for user in users]

    @classmethod
    def get_user_by_login(cls, db: Session, login: str) -> UserModel | None:
        return db.query(UserModel).filter(UserModel.login == login).first()

    @classmethod
    def get_user_by_name(cls, db: Session, name: str) -> UserModel | None:
        return db.query(UserModel).filter(UserModel.login == name).first()

    @classmethod
    def find_users_by_name_or_id(cls, db: Session, query: str) -> list[UserResponseScheme]:
        """Поиск пользователей с базовыми данными (id и name)"""
        query = query.strip()
        if not query:
            return cls.get_users(db)

        users = (
            db.query(UserModel)
            .filter(
                or_(
                    cast(UserModel.id, String).ilike(f"{query}%"),
                    UserModel.first_name.ilike(f"%{query}%"),
                    UserModel.second_name.ilike(f"%{query}%"),
                    UserModel.surname.ilike(f"%{query}%"),
                    func.concat(
                        UserModel.first_name, ' ',
                        UserModel.second_name, ' ',
                        UserModel.surname
                    ).ilike(f"%{query}%"),
                )
            )
            .order_by(UserModel.id)
            .all()
        )

        return [UserResponseScheme(id=user.id, name=" ".join(filter(None, [user.first_name, user.second_name, user.surname]))) for user in users]
    @classmethod
    def get_user_by_login_with_details(cls, db: Session, login: str) -> UserModel | None:
        """Получить пользователя по логину со всеми связями"""
        return db.query(UserModel).options(
            joinedload(UserModel.department),
            joinedload(UserModel.position),
            joinedload(UserModel.manager)
        ).filter(UserModel.login == login).first()

    @classmethod
    def find_users_by_name_or_id_with_details(cls, db: Session, query: str | None) -> list[UserResponseScheme]:
        """Поиск пользователей с полными данными"""
        if not query:
            return cls.get_users_with_details(db)
        
        query = query.strip()
        users = (
            db.query(UserModel)
            .options(
                joinedload(UserModel.department),
                joinedload(UserModel.position),
                joinedload(UserModel.manager)
            )
            .filter(
                or_(
                    cast(UserModel.id, String).ilike(f"{query}%"),
                    UserModel.first_name.ilike(f"%{query}%"),
                    UserModel.second_name.ilike(f"%{query}%"),
                    UserModel.surname.ilike(f"%{query}%"),
                    func.concat(
                        UserModel.first_name, ' ',
                        UserModel.second_name, ' ',
                        UserModel.surname
                    ).ilike(f"%{query}%"),
                    UserModel.login.ilike(f"%{query}%"),
                )
            )
            .order_by(UserModel.id)
            .all()
        )
        
        return [cls._to_user_response(user) for user in users]

    @classmethod
    def delete_user(cls, db: Session, login: str) -> bool:
        user = db.query(UserModel).filter(UserModel.login == login).first()
        if user is None:
            return False

        db.delete(user)
        db.commit()
        return True

    @classmethod
    def _to_user_response(cls, user: UserModel) -> UserResponseScheme:
        """Преобразует модель пользователя в схему ответа с полными данными"""
        # Формируем ФИО
        name_parts = [user.surname, user.first_name, user.second_name]
        full_name = " ".join(filter(None, name_parts)) or user.login
        
        # Получаем название отдела
        department_title = None
        if user.department:
            department_title = user.department.department_title
        
        # Получаем название должности
        position_name = None
        if user.position:
            position_name = user.position.full_name or user.position.short_name
        
        # Получаем ФИО руководителя
        manager_name = None
        if user.manager:
            manager_parts = [user.manager.surname, user.manager.first_name, user.manager.second_name]
            manager_name = " ".join(filter(None, manager_parts)) or user.manager.login
        
        return UserResponseScheme(
            id=user.id,
            name=full_name,
            login=user.login,
            first_name=user.first_name,
            second_name=user.second_name,
            surname=user.surname,
            sex=user.sex,
            birth_date=user.birth_date.isoformat() if user.birth_date else None,
            department_id=user.department_id,
            department_title=department_title,
            position_id=user.position_id,
            position_name=position_name,
            manager_id=user.manager_id,
            manager_name=manager_name,
            is_superuser=bool(user.is_superuser),
        )


class S3Repository:
    def __init__(self) -> None:
        self._endpoint_url = settings.s3_endpoint_url.rstrip("/")
        self._bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            # region_name="Ekaterinburg",
            use_ssl=settings.s3_secure,
        )
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            if error_code not in {"404", "NoSuchBucket", "NotFound"}:
                raise

            self._client.create_bucket(Bucket=self._bucket)

        self._ensure_public_read_access()

    def _ensure_public_read_access(self) -> None:
        # Для MinIO корректный способ открыть чтение — bucket policy, без ACL.
        public_read_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "PublicReadGetObject",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{self._bucket}/*"],
                }
            ],
        }
        self._client.put_bucket_policy(
            Bucket=self._bucket,
            Policy=json.dumps(public_read_policy),
        )

    def upload_bytes(self, *, content: bytes, filename: str, content_type: str | None = None) -> str:
        suffix = Path(filename).suffix.lower()
        object_key = f"{uuid4().hex}{suffix}"
        put_params = {
            "Bucket": self._bucket,
            "Key": object_key,
            "Body": content,
        }
        if content_type is not None:
            put_params["ContentType"] = content_type

        self._client.put_object(**put_params)
        return f"{self._endpoint_url}/{self._bucket}/{object_key.lstrip('/')}"

    def upload_file(self, file: UploadFile) -> str:
        object_key = f"{uuid4().hex}{Path(file.filename).suffix.lower()}"
        put_params = {
            "Bucket": self._bucket,
            "Key": object_key,
            "Body": file.file,
        }
        if file.content_type is not None:
            put_params["ContentType"] = file.content_type

        file.file.seek(0)
        self._client.put_object(**put_params)
        return f"{self._endpoint_url}/{self._bucket}/{object_key.lstrip('/')}"

    def delete_file_by_url(self, file_url: str) -> None:
        prefix = f"{self._endpoint_url}/{self._bucket}/"
        object_key = file_url.removeprefix(prefix)
        self._client.delete_object(Bucket=self._bucket, Key=object_key)

    def copy_file_by_url(self, file_url: str) -> str:
        prefix = f"{self._endpoint_url}/{self._bucket}/"
        source_key = file_url.removeprefix(prefix)
        suffix = Path(source_key).suffix.lower()
        target_key = f"{uuid4().hex}{suffix}"
        self._client.copy_object(
            Bucket=self._bucket,
            CopySource={"Bucket": self._bucket, "Key": source_key},
            Key=target_key,
        )
        return f"{self._endpoint_url}/{self._bucket}/{target_key.lstrip('/')}"