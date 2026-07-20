import sys
import logging
from typing import List
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

class Settings(BaseSettings):

    APP_NAME: str = "Medical Clinic AI Service"
    ENVIRONMENT: str = Field(default="development")
    PORT: int = Field(default=8000)
    SECRET_KEY: str = Field(..., min_length=32)

    HF_TOKEN: str = Field(...)
    HF_MODEL: str = Field(default="HuggingFaceH4/zephyr-7b-beta")
    HF_MAX_NEW_TOKENS: int = Field(default=800, ge=100, le=4096)
    HF_TEMPERATURE: float = Field(default=0.3, ge=0.0, le=2.0)
    HF_TOP_P: float = Field(default=0.9, ge=0.0, le=1.0)
    HF_TIMEOUT: int = Field(default=60, ge=5, le=300)

    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://localhost:5174"
    )
    TRUSTED_HOSTS: str = Field(default="localhost,127.0.0.1")

    RATE_LIMIT_PER_MINUTE: int = Field(default=30, ge=1)
    RATE_LIMIT_CHAT_PER_MINUTE: int = Field(default=15, ge=1)

    INTERNAL_API_KEY: str = Field(..., min_length=32)

    REDIS_URL: str = Field(default="")

    CLINIC_NAME: str = Field(default="MediCare Clinic")
    CLINIC_PHONE: str = Field(default="+1-800-MEDICARE")
    CLINIC_EMAIL: str = Field(default="info@medicareclinic.com")
    CLINIC_ADDRESS: str = Field(default="123 Health Ave, Medical City, MC 10001")
    CLINIC_HOURS: str = Field(
        default="Monday-Friday: 8AM-6PM | Saturday: 9AM-2PM | Sunday: Closed"
    )
    CLINIC_EMERGENCY: str = Field(
        default="For emergencies, dial 911 or visit the nearest ER"
    )

    MAX_CONVERSATION_HISTORY: int = Field(default=10, ge=1, le=50)
    ENABLE_SYMPTOM_TRIAGE: bool = Field(default=True)
    ENABLE_CONVERSATION_SUMMARY: bool = Field(default=True)

    @property
    def cors_origins(self) -> List[str]:
        raw = self.ALLOWED_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        if raw.startswith("["):
            import json
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> List[str]:
        raw = self.TRUSTED_HOSTS.strip()
        if raw.startswith("["):
            import json
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [h.strip() for h in raw.split(",") if h.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}, got: {v!r}")
        return v

    @field_validator("HF_TOKEN")
    @classmethod
    def validate_hf_token(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("HF_TOKEN is empty. Create at: https://huggingface.co/settings/tokens")
        if not (v.startswith("hf_") or v.startswith("hf-")):
            logger.warning("HF_TOKEN does not start with 'hf_' — verify it is valid")
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @field_validator("INTERNAL_API_KEY")
    @classmethod
    def validate_internal_api_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("INTERNAL_API_KEY must be at least 32 characters long")
        return v

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }

try:
    settings = Settings()
except Exception as e:
    print("\n" + "=" * 70, file=sys.stderr)
    print("❌  CONFIGURATION ERROR — AI Service cannot start", file=sys.stderr)
    print("=" * 70, file=sys.stderr)
    print(f"\n{e}\n", file=sys.stderr)
    print("Required .env variables:", file=sys.stderr)
    print("  SECRET_KEY        — random 32+ char string", file=sys.stderr)
    print("  HF_TOKEN          — from huggingface.co/settings/tokens", file=sys.stderr)
    print("  INTERNAL_API_KEY  — random 32+ char string (shared with backend)", file=sys.stderr)
    print("=" * 70 + "\n", file=sys.stderr)
    sys.exit(1)