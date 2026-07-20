import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.core.security import verify_internal_api_key
from app.models.schemas import ErrorResponse, IntentRequest, IntentResponse
from app.services.intent_service import intent_detector

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/detect", response_model=IntentResponse,
             responses={400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
             summary="Detect message intent")
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def detect_intent(
    request: Request,
    response: Response,
    body: IntentRequest,
    _api_key: str = Depends(verify_internal_api_key),
) -> IntentResponse:
    try:
        t0 = time.monotonic()
        intent = intent_detector.detect(body.message)
        elapsed_ms = round((time.monotonic() - t0) * 1000, 3)
        return IntentResponse(success=True, intent=intent, processing_time_ms=elapsed_ms)
    except Exception as exc:
        logger.error(f"Intent detection error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Intent detection failed"},
        )

@router.post("/extract-symptoms", summary="Extract symptom keywords from message")
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def extract_symptoms(
    request: Request,
    response: Response,
    body: IntentRequest,
    _api_key: str = Depends(verify_internal_api_key),
) -> dict:
    try:
        symptoms     = intent_detector.extract_symptoms(body.message)
        is_emergency = intent_detector.is_emergency(body.message)
        return {
            "success":       True,
            "symptoms":      symptoms,
            "is_emergency":  is_emergency,
            "symptom_count": len(symptoms),
        }
    except Exception as exc:
        logger.error(f"Symptom extraction error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Symptom extraction failed"},
        )