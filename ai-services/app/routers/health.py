import logging
import time

from fastapi import APIRouter

from app.core.config import settings
from app.models.schemas import HealthResponse, LivenessResponse, ReadinessResponse
from app.services.huggingface_service import hf_service

logger = logging.getLogger(__name__)
router = APIRouter()
_SERVICE_START = time.monotonic()

@router.get("/health", response_model=HealthResponse, summary="Full health check")
async def health_check() -> HealthResponse:
    hf_ok = await hf_service.health_check()
    if not hf_ok:
        logger.warning("Health check: HuggingFace connectivity is degraded")
    return HealthResponse(
        status="healthy" if hf_ok else "degraded",
        service=settings.APP_NAME,
        version="1.0.0",
        environment=settings.ENVIRONMENT,
        hf_status="connected" if hf_ok else "degraded",
        model=settings.HF_MODEL,
        uptime_seconds=round(time.monotonic() - _SERVICE_START, 2),
    )

@router.get("/health/live", response_model=LivenessResponse, summary="Liveness probe")
async def liveness() -> LivenessResponse:
    return LivenessResponse(status="alive")

@router.get("/health/ready", response_model=ReadinessResponse, summary="Readiness probe")
async def readiness() -> ReadinessResponse:
    checks = {
        "config_loaded":       True,
        "hf_model_configured": bool(settings.HF_MODEL),
        "clinic_info_loaded":  bool(settings.CLINIC_NAME),
        "api_key_configured":  bool(settings.INTERNAL_API_KEY),
    }
    return ReadinessResponse(
        status="ready" if all(checks.values()) else "not_ready",
        checks=checks,
    )

@router.get("/health/stats", summary="Service telemetry")
async def stats() -> dict:
    return {
        "uptime_seconds": round(time.monotonic() - _SERVICE_START, 2),
        "environment":    settings.ENVIRONMENT,
        "model":          settings.HF_MODEL,
        "hf_stats":       hf_service.get_stats(),
    }