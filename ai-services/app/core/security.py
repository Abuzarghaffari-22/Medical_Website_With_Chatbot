import logging
import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import settings

logger = logging.getLogger(__name__)

_api_key_header = APIKeyHeader(name="X-Internal-API-Key", auto_error=False)

async def verify_internal_api_key(
    api_key: str = Security(_api_key_header),
) -> str:
    """
    Dependency — verifies the X-Internal-API-Key header.

    Returns the key on success so it can be used downstream if needed.
    Raises HTTP 403 for both missing and invalid keys (avoids leaking info).

    Usage:
        @router.post("/endpoint")
        async def endpoint(_: str = Depends(verify_internal_api_key)):
            ...
    """
    if not api_key:
        logger.warning("Rejected: missing X-Internal-API-Key header")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": "X-Internal-API-Key header is required",
            },
        )

    expected = settings.INTERNAL_API_KEY

    # Timing-safe comparison — prevents attackers from guessing key length/content
    if not secrets.compare_digest(
        api_key.encode("utf-8"),
        expected.encode("utf-8"),
    ):
        logger.warning("Rejected: invalid X-Internal-API-Key")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": "Invalid API key",
            },
        )

    return api_key