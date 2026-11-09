import math
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, StringConstraints


def blank_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


# Optional free-text field: trimmed, and "" is normalised to null so forms can send empty inputs.
def OptionalStr(max_length: int) -> Any:  # noqa: N802 - reads like a type
    return Annotated[
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)] | None,
        BeforeValidator(blank_to_none),
    ]


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int, page_size: int) -> "Page[T]":
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )
