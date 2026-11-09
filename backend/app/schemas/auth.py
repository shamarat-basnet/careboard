import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    # The upper bound stops absurdly large inputs from reaching the hash function.
    password: Annotated[str, StringConstraints(min_length=1, max_length=256)]

    @field_validator("email")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.lower()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
