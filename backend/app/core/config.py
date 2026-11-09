from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/healthcare"
    # True on Vercel: short-lived functions must not keep pooled connections open.
    serverless: bool = False
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    log_level: str = "INFO"

    # Login. Sessions live in the database and are sent as an httpOnly cookie.
    session_ttl_hours: int = Field(default=12, ge=1)
    cookie_secure: bool = False  # set true when served over HTTPS
    max_login_attempts: int = Field(default=5, ge=1)
    lockout_minutes: int = Field(default=15, ge=1)
    # Optional first account, created at start-up only if no users exist yet.
    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "Admin"

    seed_patient_count: int = Field(default=150, ge=0, le=10_000)

    # Summary generation: "template" is deterministic and offline; "llm" uses Claude and
    # falls back to the template if the call fails or no API key is configured.
    summary_provider: Literal["template", "llm"] = "template"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        # Hosted Postgres providers (Neon, Vercel, Supabase) hand out "postgres://" or
        # "postgresql://" URLs; SQLAlchemy needs to be told to use the psycopg 3 driver.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
