from fastapi import APIRouter
from .user_api import router as user_router
from .onlyoffice_api import router as onlyoffice_router
from .document_api import router as document_router
main_router = APIRouter(prefix='/api')

main_router.include_router(user_router)
main_router.include_router(onlyoffice_router)
main_router.include_router(document_router)