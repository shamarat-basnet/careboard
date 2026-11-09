import logging
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.requests")

QUIET_PATHS = {"/health"}


class RequestLoggingMiddleware:
    """Logs method, path, status and latency for each request and tags it with a request id.

    Implemented as pure ASGI middleware (rather than BaseHTTPMiddleware) to avoid buffering
    and contextvar pitfalls. An incoming X-Request-ID is honoured so ids can be correlated
    across services; otherwise a new one is generated and returned in the response.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        incoming = headers.get(b"x-request-id", b"").decode()
        request_id = incoming if 0 < len(incoming) <= 64 else uuid.uuid4().hex
        status_code = 500
        start = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                MutableHeaders(scope=message).append("X-Request-ID", request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            path = scope["path"]
            level = logging.DEBUG if path in QUIET_PATHS else logging.INFO
            logger.log(
                level,
                "%s %s -> %d (%.1f ms) request_id=%s",
                scope["method"],
                path,
                status_code,
                duration_ms,
                request_id,
            )
