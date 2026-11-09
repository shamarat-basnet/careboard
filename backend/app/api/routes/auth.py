from fastapi import APIRouter, Request, Response, status

from app.api.deps import SESSION_COOKIE, CurrentUser, DbSession
from app.core.config import get_settings
from app.core.errors import ErrorResponse
from app.schemas.auth import LoginRequest, UserRead
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])

# Strict + httpOnly: scripts can't read the cookie, and other sites can't make the browser send
# it (which also covers cross-site request forgery for this cookie-based API).
_COOKIE = {"httponly": True, "samesite": "strict", "path": "/"}


@router.post(
    "/login",
    response_model=UserRead,
    responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def login(payload: LoginRequest, response: Response, db: DbSession) -> UserRead:
    settings = get_settings()
    user, token = service.login(db, payload.email, payload.password, settings)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_ttl_hours * 3600,
        secure=settings.cookie_secure,
        **_COOKIE,
    )
    response.headers["Cache-Control"] = "no-store"
    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession) -> None:
    if token := request.cookies.get(SESSION_COOKIE):
        service.logout(db, token)
    response.delete_cookie(SESSION_COOKIE, secure=get_settings().cookie_secure, **_COOKIE)


@router.get("/me", response_model=UserRead, responses={401: {"model": ErrorResponse}})
def me(user: CurrentUser, response: Response) -> UserRead:
    response.headers["Cache-Control"] = "no-store"
    return UserRead.model_validate(user)
