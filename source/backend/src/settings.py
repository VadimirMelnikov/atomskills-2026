from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env лежит в корне проекта — путь от каталога этого файла, не от cwd
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_ROOT.parent / ".env"


class Settings(BaseSettings):
    db_url: str
    secret_key: str
    cookie_secure: bool = False
    # Дефолты совпадают с сервисом minio в docker-compose (короткий .env без S3_* снова валиден).
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "atomskills"
    s3_secure: bool = False
    public_backend_url: str = "http://localhost:8000"
    onlyoffice_public_url: str = "http://localhost:8082"
    onlyoffice_internal_url: str = "http://onlyoffice"
    onlyoffice_internal_callback_base_url: str = "http://backend:8000"
    onlyoffice_jwt_secret: str = "onlyoffice_secret_key_for_jwt_32b"
    superuser_id: str = "__superuser__"
    superuser_login: str = "admin"

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra= "ignore",
        case_sensitive=False
    )

settings = Settings()
