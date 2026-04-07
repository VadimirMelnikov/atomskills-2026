from sqlalchemy.orm import Session

from database.repositories import UserRepository
from schemas.users import UserResponseScheme


class UserService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_users(self) -> list[UserResponseScheme]:
        return UserRepository.get_users_with_details(self._db)

    def find_users_by_name_or_id(self, query: str | None) -> list[UserResponseScheme]:
        if query is None:
            return self.get_users()
        return UserRepository.find_users_by_name_or_id_with_details(self._db, query)