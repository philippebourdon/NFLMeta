from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Callable, Mapping, MutableMapping, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .errors import NFLMetaInvalidUrlError, NFLMetaTimeoutError, create_http_error
from .types import APIResponse, QueryParams, RateLimitInfo

__version__ = "0.2.0"
USER_AGENT = f"nflmeta-python/{__version__}"


def _normalize_base_url(base_url: str | None) -> str:
    base = (base_url or "https://nflmeta.org").strip()
    return base.rstrip("/")


def _origin(url: str) -> tuple[str, str]:
    parts = urlsplit(url)
    return (parts.scheme.lower(), parts.netloc.lower())


def _resolve_request_url(base_url: str, path: str) -> str:
    """Resolve a caller-supplied path against the base, refusing anything that leaves it.

    This used to accept any absolute http(s) URL and then attach X-NFLMeta-Key to
    it unconditionally, so an application passing a user-controlled or mistakenly
    absolute URL handed its API key to whatever host was named.

    The boundary is the one mcp-server/src/api-client.mts already enforces: stay
    on the configured origin, and keep the path inside /api/v1. Every endpoint
    this client can reach lives there. Same-origin absolute URLs are still
    accepted -- they are not a leak.
    """
    base = f"{base_url}/"
    resolved = urljoin(base, path)
    if _origin(resolved) != _origin(base):
        raise NFLMetaInvalidUrlError(
            f"Refusing to send the API key to {urlsplit(resolved).netloc}. "
            f"Requests must stay on {urlsplit(base).netloc}."
        )
    if not urlsplit(resolved).path.startswith("/api/v1/"):
        raise NFLMetaInvalidUrlError(
            f"The request path resolved outside /api/v1: {urlsplit(resolved).path}"
        )
    return resolved


class _SameOriginRedirectHandler(HTTPRedirectHandler):
    """Follow same-origin redirects; refuse to carry the key across an origin.

    Redirects are a second way the key escapes, and one the request-URL check does
    not cover. Measured on 2026-08-27 against a local server: urllib forwards
    every request header across a cross-origin redirect -- X-NFLMeta-Key AND
    Authorization, which even Node's fetch strips.

    Same-origin redirects are left alone: the API normalises trailing slashes with
    a 308 and that has to keep working.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        if _origin(newurl) != _origin(req.full_url):
            raise NFLMetaInvalidUrlError(
                f"Refusing to follow a redirect to {urlsplit(newurl).netloc}, which would send "
                f"the API key off {urlsplit(req.full_url).netloc}."
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPENER = build_opener(_SameOriginRedirectHandler())


def _serialize_query_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _build_query_string(query: QueryParams | None) -> str:
    if not query:
        return ""
    pairs: list[tuple[str, str]] = []
    for key, raw_value in query.items():
        if raw_value is None:
            continue
        values = raw_value if isinstance(raw_value, (list, tuple)) else [raw_value]
        for value in values:
            if value is None:
                continue
            pairs.append((key, _serialize_query_value(value)))
    return urlencode(pairs)


def _lookup_header(headers: Mapping[str, str], name: str) -> Optional[str]:
    """Case-insensitive header lookup.

    HTTP header names are case-insensitive, but the transport hands back a plain
    dict built from whatever casing the wire used. Looking these up by the
    canonical spelling returned None for every response, so the documented
    ``response.rate_limit.remaining`` was always None in Python while the
    TypeScript SDK reported the real number.
    """
    value = headers.get(name)
    if value is not None:
        return value
    target = name.lower()
    for key, candidate in headers.items():
        if key.lower() == target:
            return candidate
    return None


def _parse_int_header(headers: Mapping[str, str], name: str) -> Optional[int]:
    value = _lookup_header(headers, name)
    if not value:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_rate_limit(headers: Mapping[str, str]) -> RateLimitInfo:
    return RateLimitInfo(
        limit=_parse_int_header(headers, "X-RateLimit-Limit"),
        remaining=_parse_int_header(headers, "X-RateLimit-Remaining"),
        reset=_lookup_header(headers, "X-RateLimit-Reset"),
        policy=_lookup_header(headers, "X-RateLimit-Policy"),
    )


def _decode_payload(raw: bytes, content_type: str | None) -> Any:
    text = raw.decode("utf-8") if raw else ""
    if not text:
        return None
    if content_type and "application/json" in content_type.lower():
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"message": text}
    return {"message": text}


@dataclass(slots=True)
class TransportResponse:
    status: int
    headers: MutableMapping[str, str]
    payload: Any


def _default_transport(url: str, headers: Mapping[str, str], timeout: float | None) -> TransportResponse:
    request_headers = dict(headers)
    # urllib supplies its own "Python-urllib/x.y" User-Agent when none is set,
    # and the edge in front of the API rejects that string outright: every call
    # from the published package came back 403 (Cloudflare error 1010) before
    # reaching the application. Note the fix is to send a real User-Agent, not
    # to send none -- omitting it is what produces the failing default.
    if not _lookup_header(request_headers, "User-Agent"):
        request_headers["User-Agent"] = USER_AGENT
    request = Request(url, headers=request_headers, method="GET")
    try:
        # _OPENER, not urlopen: the default opener follows a cross-origin
        # redirect and re-sends every header, key included.
        with _OPENER.open(request, timeout=timeout) as response:
            raw = response.read()
            response_headers = {key: value for key, value in response.headers.items()}
            payload = _decode_payload(raw, response.headers.get("Content-Type"))
            return TransportResponse(status=response.status, headers=response_headers, payload=payload)
    except HTTPError as error:
        raw = error.read()
        response_headers = {key: value for key, value in error.headers.items()}
        payload = _decode_payload(raw, error.headers.get("Content-Type"))
        return TransportResponse(status=error.code, headers=response_headers, payload=payload)
    except TimeoutError as error:
        raise NFLMetaTimeoutError(timeout or 0.0) from error
    except socket.timeout as error:
        raise NFLMetaTimeoutError(timeout or 0.0) from error
    except URLError as error:
        if isinstance(error.reason, socket.timeout):
            raise NFLMetaTimeoutError(timeout or 0.0) from error
        raise


Transport = Callable[[str, Mapping[str, str], float | None], TransportResponse]


class NFLMetaClientCore:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float | None = None,
        headers: Mapping[str, str] | None = None,
        transport: Transport | None = None,
    ) -> None:
        self.api_key = api_key.strip() if api_key else None
        self.base_url = _normalize_base_url(base_url)
        self.timeout = timeout
        self.default_headers = dict(headers or {})
        self._transport = transport or _default_transport

    def get(
        self,
        path: str,
        query: QueryParams | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> APIResponse:
        # Before any header is built: a URL that leaves the configured origin must
        # never reach the point where the key is attached.
        url = _resolve_request_url(self.base_url, path)
        query_string = _build_query_string(query)
        if query_string:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}{query_string}"

        request_headers: dict[str, str] = {"Accept": "application/json"}
        request_headers.update(self.default_headers)
        if headers:
            request_headers.update(headers)
        if self.api_key and "X-NFLMeta-Key" not in request_headers:
            request_headers["X-NFLMeta-Key"] = self.api_key

        transport_response = self._transport(url, request_headers, self.timeout)
        rate_limit = _parse_rate_limit(transport_response.headers)

        if transport_response.status < 200 or transport_response.status >= 300:
            raise create_http_error(transport_response.status, transport_response.payload, rate_limit)

        payload = transport_response.payload
        if not isinstance(payload, dict) or "data" not in payload:
            raise create_http_error(transport_response.status, payload, rate_limit)

        return APIResponse(
            data=payload.get("data"),
            meta=payload.get("meta"),
            status=transport_response.status,
            rate_limit=rate_limit,
            headers=transport_response.headers,
        )
