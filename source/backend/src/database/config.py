from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase

from settings import settings

engine = create_engine(settings.db_url)
session = sessionmaker(
    bind=engine,
    class_=Session,
    autocommit=False,
    expire_on_commit=False)

def get_session():
    db = session()
    try:
        yield db
    finally:
        db.close()

class Base(DeclarativeBase):
    pass

