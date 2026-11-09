from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import UnauthorizedError
from app.db.session import get_db
from app.models import User
from app.services import auth as auth_service
from app.services.summary import Narrator, build_narrator

SESSION_COOKIE = "session"

DbSession = Annotated[Session, Depends(get_db)]


@lru_cache
def get_narrator() -> Narrator:
    return build_narrator(get_settings())


def get_current_user(request: Request, db: DbSession) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    user = auth_service.user_for_token(db, token) if token else None
    if user is None:
        raise UnauthorizedError("Please sign in.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
