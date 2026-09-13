from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Mapping, MutableMapping, Optional, Sequence, Union

QueryScalar = Union[str, int, float, bool, date, datetime]
QueryValue = Union[QueryScalar, Sequence[QueryScalar], None]
QueryParams = Mapping[str, QueryValue]


@dataclass(slots=True)
class RateLimitInfo:
    limit: Optional[int] = None
    remaining: Optional[int] = None
    reset: Optional[str] = None
    policy: Optional[str] = None


@dataclass(slots=True)
class APIResponse:
    data: Any
    meta: Any = None
    status: int = 200
    rate_limit: RateLimitInfo = field(default_factory=RateLimitInfo)
    headers: Mapping[str, str] | MutableMapping[str, str] | None = None


@dataclass(slots=True)
class FieldValue:
    field: str
    value: Any
