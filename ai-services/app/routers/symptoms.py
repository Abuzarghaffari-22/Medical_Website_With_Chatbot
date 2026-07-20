import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.core.security import verify_internal_api_key
from app.models.schemas import ErrorResponse, SymptomRequest, SymptomResponse
from app.services.symptom_service import symptom_classifier

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/analyze", response_model=SymptomResponse,
             responses={400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
             summary="Analyze symptoms and return triage result")
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def analyze_symptoms(
    request: Request,
    response: Response,
    body: SymptomRequest,
    _api_key: str = Depends(verify_internal_api_key),
) -> SymptomResponse:
    try:
        t0        = time.monotonic()
        analysis  = symptom_classifier.classify(
            symptoms=body.symptoms,
            patient_context=body.patient_context or {},
        )
        follow_up  = symptom_classifier.get_follow_up_questions(body.symptoms)
        elapsed_ms = round((time.monotonic() - t0) * 1000, 3)
        return SymptomResponse(
            success=True,
            analysis=analysis,
            follow_up_questions=follow_up,
            processing_time_ms=elapsed_ms,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "validation_error", "message": str(exc)},
        )
    except Exception as exc:
        logger.error(f"Symptom analysis error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Symptom analysis failed"},
        )

@router.get("/urgency-levels", summary="List urgency levels")
async def list_urgency_levels() -> dict:
    return {
        "urgency_levels": {
            "emergency":   "Call 911 / Go to the ER immediately",
            "urgent":      "See a doctor today or within 24 hours",
            "semi_urgent": "See a doctor within 2–3 days",
            "non_urgent":  "Schedule a routine appointment",
            "self_care":   "Manageable at home with rest / OTC remedies",
            "unknown":     "Unable to determine — please consult a doctor",
        }
    }