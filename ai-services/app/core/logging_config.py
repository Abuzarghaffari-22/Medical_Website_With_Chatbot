import logging
import logging.handlers
import os
import sys
from pythonjsonlogger import jsonlogger

class HealthCheckFilter(logging.Filter):
    """Suppress noisy liveness/readiness probe logs in production."""
    _SUPPRESSED = {"/api/health/live", "/api/health/ready"}

    def filter(self, record: logging.LogRecord) -> bool:
        return not any(path in record.getMessage() for path in self._SUPPRESSED)

class PrettyFormatter(logging.Formatter):
    """ANSI-coloured formatter for local development."""
    _COLORS = {
        "DEBUG":    "\033[36m",   # Cyan
        "INFO":     "\033[32m",   # Green
        "WARNING":  "\033[33m",   # Yellow
        "ERROR":    "\033[31m",   # Red
        "CRITICAL": "\033[35m",   # Magenta
    }
    _RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self._COLORS.get(record.levelname, self._RESET)
        record.levelname = f"{color}{record.levelname:<8}{self._RESET}"
        return super().format(record)

def setup_logging(environment: str | None = None) -> None:
    """
    Configure application-wide logging.

    Args:
        environment: "development" | "staging" | "production"
                     Falls back to ENVIRONMENT env-var, then "development".
    """
    if environment is None:
        try:
            from app.core.config import settings
            environment = settings.ENVIRONMENT
        except Exception:
            environment = os.getenv("ENVIRONMENT", "development")

    is_production = environment == "production"
    log_level = logging.INFO if is_production else logging.DEBUG

    root = logging.getLogger()
    root.setLevel(log_level)
    root.handlers.clear()

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(log_level)

    if is_production:
        json_fmt = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
            rename_fields={
                "asctime": "timestamp",
                "levelname": "level",
                "name": "logger",
            },
        )
        stdout_handler.setFormatter(json_fmt)
        stdout_handler.addFilter(HealthCheckFilter())
    else:
        pretty_fmt = PrettyFormatter(
            fmt="%(asctime)s │ %(levelname)s │ %(name)-40s │ %(message)s",
            datefmt="%H:%M:%S",
        )
        stdout_handler.setFormatter(pretty_fmt)

    root.addHandler(stdout_handler)

    logs_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(logs_dir, exist_ok=True)

    file_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(logs_dir, "ai_service.log"),
        maxBytes=10 * 1024 * 1024,   # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(
        jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d",
            datefmt="%Y-%m-%dT%H:%M:%S",
            rename_fields={"asctime": "timestamp", "levelname": "level"},
        )
    )
    file_handler.addFilter(HealthCheckFilter())
    root.addHandler(file_handler)

    for noisy in ("httpx", "httpcore", "hpack", "urllib3", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        f"Logging configured | env={environment} | level={logging.getLevelName(log_level)}"
    )