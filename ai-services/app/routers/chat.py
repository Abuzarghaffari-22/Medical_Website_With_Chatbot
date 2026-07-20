import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.core.security import verify_internal_api_key
from app.models.schemas import ChatRequest, ChatResponse, ErrorResponse
from app.services.chat_service import chat_orchestrator

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/",
    response_model=ChatResponse,
    responses={
        400: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Send message to MediBot AI chatbot",
)
@limiter.limit(f"{settings.RATE_LIMIT_CHAT_PER_MINUTE}/minute")
async def chat(
    request: Request,
    response: Response,
    body: ChatRequest,
    _api_key: str = Depends(verify_internal_api_key),
) -> ChatResponse:
    try:
        return await chat_orchestrator.process(body)
    except ValueError as exc:
        logger.warning(f"Chat validation error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "validation_error", "message": str(exc)},
        )
    except Exception as exc:
        logger.error(f"Chat endpoint error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "An error occurred processing your request"},
        )

@router.get("/test", summary="Connectivity test — no AI call")
async def test_chat(
    _api_key: str = Depends(verify_internal_api_key),
) -> dict:
    return {
        "status":      "operational",
        "model":       settings.HF_MODEL,
        "clinic":      settings.CLINIC_NAME,
        "environment": settings.ENVIRONMENT,
    }