from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .types import RateLimitInfo


@dataclass(slots=True)
class NFLMetaErrorDetails:
    code: Optional[str] = None
    payload: Any = None
    rate_limit: Optional[RateLimitInfo] = None


class NFLMetaError(Exception):
    def __init__(self, message: str, status: int, details: NFLMetaErrorDetails | None = None) -> None:
        super().__init__(message)
        details = details or NFLMetaErrorDetails()
        self.status = status
        self.code = details.code
        self.payload = details.payload
        self.rate_limit = details.rate_limit


class NFLMetaInvalidUrlError(NFLMetaError):
    """A request was refused before it was sent, because its URL left the API origin.

    ``status`` is 0 precisely because nothing was transmitted: the client attaches
    X-NFLMeta-Key to every request, so a URL pointing elsewhere has to be stopped
    before any header is built, not reported after the fact.
    """

    def __init__(self, message: str, details: NFLMetaErrorDetails | None = None) -> None:
        details = details or NFLMetaErrorDetails()
        if details.code is None:
            details.code = "invalid_url"
        super().__init__(message, 0, details)


class NFLMetaBadRequestError(NFLMetaError):
    pass


class NFLMetaUnauthorizedError(NFLMetaError):
    pass


class NFLMetaNotFoundError(NFLMetaError):
    pass


class NFLMetaRateLimitError(NFLMetaError):
    pass


class NFLMetaTimeoutError(TimeoutError):
    def __init__(self, timeout_seconds: float) -> None:
        super().__init__(f"NFLMeta request timed out after {timeout_seconds:.3f}s")
        self.timeout_seconds = timeout_seconds


def _error_message(payload: Any, status: int) -> str:
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return message
    return f"NFLMeta request failed with status {status}"


def _error_code(payload: Any) -> Optional[str]:
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            code = error.get("code")
            if isinstance(code, str) and code.strip():
                return code
    return None


def create_http_error(status: int, payload: Any, rate_limit: RateLimitInfo | None = None) -> NFLMetaError:
    details = NFLMetaErrorDetails(
        code=_error_code(payload),
        payload=payload,
        rate_limit=rate_limit,
    )
    message = _error_message(payload, status)
    if status == 400:
        return NFLMetaBadRequestError(message, status, details)
    if status == 401:
        return NFLMetaUnauthorizedError(message, status, details)
    if status == 404:
        return NFLMetaNotFoundError(message, status, details)
    if status == 429:
        return NFLMetaRateLimitError(message, status, details)
    return NFLMetaError(message, status, details)
