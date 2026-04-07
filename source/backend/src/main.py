from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import main_router
from auth.auth import authx
from database.config import session as session_factory
from database.models import UserModel
from settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = session_factory()
    try:
        user = db.get(UserModel, settings.superuser_id)
        if user is None:
            db.add(
                UserModel(
                    id=settings.superuser_id,
                    login=settings.superuser_login,
                    is_superuser=True,
                )
            )
        else:
            user.login = settings.superuser_login
            user.is_superuser = True
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(lifespan=lifespan)

# Браузер шлёт Origin с портом (localhost:8000 ≠ localhost). Без точного совпадения — «Failed to fetch» / CORS.
# Разрешаем все origins в разработке для упрощения отладки CORS
# В production следует указать конкретные origins
import os
import re

# Определяем, находимся ли мы в режиме разработки
is_development = os.getenv("ENVIRONMENT", "development") == "development"

if is_development:
    # В разработке разрешаем все локальные origins и common dev ports
    # Используем regex для гибкости
    origins = [
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://0.0.0.0:8000",
        "http://0.0.0.0:5173",
        "http://0.0.0.0:3000",
    ]
else:
    # В production разрешаем только указанные origins
    origins = [
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(main_router)

authx.handle_errors(app)

@app.get("/ping", tags=["health"])
def ping():
    return "pong"


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

