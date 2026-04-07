from authx import AuthXConfig, AuthX

from settings import settings

config = AuthXConfig(
    JWT_SECRET_KEY=settings.secret_key,
    JWT_TOKEN_LOCATION=["cookies"],
    JWT_COOKIE_SECURE=settings.cookie_secure,
    JWT_COOKIE_CSRF_PROTECT=False,
)

authx = AuthX(config)
