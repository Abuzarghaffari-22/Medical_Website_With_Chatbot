import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger(__name__)

def _get_client_ip(request) -> str:
    """
    Extract real client IP — respects X-Forwarded-For behind reverse proxies.
    Only trust this header when running behind a known, controlled proxy.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return get_remote_address(request)

def _build_limiter() -> Limiter:
    redis_url = getattr(settings, "REDIS_URL", None)
    if redis_url:
        try:
            from slowapi.wrappers import storage  # noqa: F401
            limiter = Limiter(
                key_func=_get_client_ip,
                default_limits=["200/hour", "60/minute"],
                headers_enabled=True,
                strategy="fixed-window",
                storage_uri=redis_url,
            )
            logger.info("Rate limiter initialised | storage=redis")
            return limiter
        except Exception as exc:
            logger.warning(f"Redis rate limiter failed ({exc}), falling back to in-memory")

    limiter = Limiter(
        key_func=_get_client_ip,
        default_limits=["200/hour", "60/minute"],
        headers_enabled=True,
        strategy="fixed-window",
    )
    logger.debug("Rate limiter initialised | storage=in-memory")
    return limiter

limiter = _build_limiter()