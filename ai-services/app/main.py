import logging
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.rate_limiter import limiter
from app.routers import chat, health, intent, symptoms

setup_logging(settings.ENVIRONMENT)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info(f"🚀 Starting {settings.APP_NAME}")
    logger.info(f"   Environment : {settings.ENVIRONMENT}")
    logger.info(f"   Model       : {settings.HF_MODEL}")
    logger.info(f"   Port        : {settings.PORT}")
    logger.info(f"   CORS origins: {settings.cors_origins}")
    logger.info("=" * 60)

    from app.services.huggingface_service import hf_service
    hf_ok = await hf_service.health_check()
    if hf_ok:
        logger.info("✅ HuggingFace connectivity: OK")
    else:
        logger.warning(
            "⚠️  HuggingFace connectivity FAILED — check HF_TOKEN permissions.\n"
            "   Token needs 'Make calls to Inference Providers' at huggingface.co/settings/tokens\n"
            "   Service will start. Chat will give clinic contact fallback until HF is reachable."
        )

    yield
    logger.info(f"🛑 {settings.APP_NAME} shutting down")

app = FastAPI(
    title=settings.APP_NAME,
    description="Medical Clinic AI chatbot — intent detection, symptom triage, AI-powered chat.",
    version="1.0.0",
    docs_url="/docs"         if settings.is_development else None,
    redoc_url="/redoc"       if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Internal-API-Key"],
    max_age=600,
)

_SILENT_PATHS = {"/api/health/live", "/api/health/ready", "/"}

@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    start    = time.monotonic()
    response = await call_next(request)
    elapsed  = round((time.monotonic() - start) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(elapsed)
    if request.url.path not in _SILENT_PATHS:
        logger.info(f"{request.method} {request.url.path} {response.status_code} {elapsed}ms")
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception | {request.method} {request.url.path} | {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "internal_server_error",
                 "message": "An unexpected error occurred. Please try again."},
    )

app.include_router(health.router,   prefix="/api",         tags=["Health"])
app.include_router(chat.router,     prefix="/api/chat",    tags=["Chat"])
app.include_router(intent.router,   prefix="/api/intent",  tags=["Intent"])
app.include_router(symptoms.router, prefix="/api/symptoms", tags=["Symptoms"])

@app.get("/", include_in_schema=False)
async def root():
    return {
        "service":     settings.APP_NAME,
        "status":      "operational",
        "version":     "1.0.0",
        "environment": settings.ENVIRONMENT,
        "docs":        "/docs" if settings.is_development else "disabled",
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.is_development,
        log_level="info",
    )