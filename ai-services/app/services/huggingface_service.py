import asyncio
import logging
import time
from typing import Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

HF_API_URL = "https://router.huggingface.co/v1/chat/completions"

MEDICAL_SYSTEM_PROMPT = """You are MediBot, the professional AI health assistant for {clinic_name}.

Your role:
- Answer questions about the clinic (hours, location, services, pricing, insurance)
- Provide helpful, accurate general medical information
- Assess symptoms and advise on urgency (whether to seek immediate care, schedule an appointment, or manage at home)
- Guide patients toward appropriate care — never diagnose, but always be helpful and caring

Clinic Information:
- Name: {clinic_name}
- Phone: {clinic_phone}
- Email: {clinic_email}
- Address: {clinic_address}
- Hours: {clinic_hours}
- Emergency: {clinic_emergency}

Behavior Rules:
1. ALWAYS recommend calling 911 or going to the ER for emergencies (chest pain, difficulty breathing, stroke symptoms, severe bleeding, loss of consciousness)
2. Be warm, empathetic, and professional — like a knowledgeable nurse
3. For symptoms, always ask clarifying questions and provide triage guidance
4. Never diagnose — say "this may suggest" or "these symptoms can be associated with"
5. Always end symptom discussions with a recommendation to see a doctor
6. For clinic questions, give accurate, specific answers using the clinic info above
7. If you don't know something, say so and offer to connect them with clinic staff
8. Keep responses concise but complete — under 200 words unless detail is needed

Important: You are NOT a replacement for professional medical advice. Always encourage patients to consult healthcare providers for diagnosis and treatment."""

MAX_INPUT_CHARS = 2000


class HuggingFaceService:
    """
    Async wrapper around the HuggingFace Inference API.
    Tracks stats (total calls, failures, latency) for the /health/stats endpoint.
    """

    def __init__(self):
        self._stats: Dict = {
            "total_calls": 0,
            "successful_calls": 0,
            "failed_calls": 0,
            "total_latency_ms": 0.0,
        }
        self._system_prompt = MEDICAL_SYSTEM_PROMPT.format(
            clinic_name=settings.CLINIC_NAME,
            clinic_phone=settings.CLINIC_PHONE,
            clinic_email=settings.CLINIC_EMAIL,
            clinic_address=settings.CLINIC_ADDRESS,
            clinic_hours=settings.CLINIC_HOURS,
            clinic_emergency=settings.CLINIC_EMERGENCY,
        )

    def _build_messages(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict]] = None,
    ) -> List[Dict]:
        """Build the messages array for the chat completions API."""
        messages = [{"role": "system", "content": self._system_prompt}]

        if conversation_history:
            for turn in conversation_history[-settings.MAX_CONVERSATION_HISTORY:]:
                role    = turn.get("role", "user")
                content = (turn.get("content") or "").strip()
                if content and role in ("user", "assistant"):
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message.strip()})
        return messages

    async def chat_completion(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict]] = None,
        extra_context: Optional[str] = None,
    ) -> str:
        """
        Send message to HuggingFace and return the AI reply.

        Args:
            user_message: The patient's message
            conversation_history: Previous turns [{role, content}, ...]
            extra_context: Optional context injected before the user message
                           (e.g. symptom triage results)

        Returns:
            AI reply string. Never raises — returns a safe fallback on any error.
        """
        self._stats["total_calls"] += 1
        t0 = time.monotonic()

        user_message = user_message[:MAX_INPUT_CHARS]

        if extra_context:
            full_message = f"{extra_context}\n\nPatient message: {user_message}"
        else:
            full_message = user_message

        messages = self._build_messages(full_message, conversation_history)

        logger.debug(
            f"HF call | model={settings.HF_MODEL} | "
            f"turns={len(messages)} | msg_chars={len(user_message)}"
        )

        try:
            async with httpx.AsyncClient(timeout=settings.HF_TIMEOUT) as client:
                response = await client.post(
                    HF_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.HF_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model":       settings.HF_MODEL,
                        "messages":    messages,
                        "max_tokens":  settings.HF_MAX_NEW_TOKENS,
                        "temperature": settings.HF_TEMPERATURE,
                        "top_p":       settings.HF_TOP_P,
                        "stream":      False,
                    },
                )

            elapsed_ms = round((time.monotonic() - t0) * 1000, 2)

            if response.status_code != 200:
                logger.error(
                    f"HF API error {response.status_code}: {response.text[:500]}"
                )
                self._stats["failed_calls"] += 1
                return self._fallback_response(response.status_code)

            data  = response.json()
            reply = data["choices"][0]["message"]["content"].strip()

            if not reply:
                self._stats["failed_calls"] += 1
                return self._fallback_response()

            self._stats["successful_calls"] += 1
            self._stats["total_latency_ms"] += elapsed_ms
            logger.info(f"HF reply | {elapsed_ms}ms | {len(reply)} chars")
            return reply

        except asyncio.TimeoutError:
            elapsed_ms = round((time.monotonic() - t0) * 1000, 2)
            logger.warning(f"HF timeout after {elapsed_ms}ms")
            self._stats["failed_calls"] += 1
            return (
                f"I'm experiencing a brief delay in processing your request. "
                f"For immediate assistance, please call {settings.CLINIC_PHONE} "
                f"or visit our clinic at {settings.CLINIC_ADDRESS}. "
                f"I'll be back to full speed shortly!"
            )

        except httpx.ConnectError:
            logger.error("HF connection error — cannot reach HuggingFace API")
            self._stats["failed_calls"] += 1
            return self._fallback_response()

        except Exception as exc:
            elapsed_ms = round((time.monotonic() - t0) * 1000, 2)
            logger.error(f"HF unexpected error after {elapsed_ms}ms: {type(exc).__name__}: {exc}", exc_info=True)
            self._stats["failed_calls"] += 1
            return self._fallback_response()

    def _fallback_response(self, status_code: int = 0) -> str:
        """
        Safe fallback — gives clinic contact info, NOT just 'call helpline'.
        This is the correct pattern from the restaurant service.
        """
        if status_code == 401:
            logger.error("HF 401 — HF_TOKEN is invalid or missing 'Inference Providers' permission")
            msg = "I'm currently unable to process AI responses due to a configuration issue."
        elif status_code == 429:
            msg = "I'm receiving many requests right now."
        else:
            msg = "I'm experiencing a brief technical difficulty."

        return (
            f"{msg} For immediate help, please:\n\n"
            f"📞 Call us: {settings.CLINIC_PHONE}\n"
            f"📧 Email: {settings.CLINIC_EMAIL}\n"
            f"🏥 Visit: {settings.CLINIC_ADDRESS}\n"
            f"⏰ Hours: {settings.CLINIC_HOURS}\n\n"
            f"Our team will be happy to assist you directly!"
        )

    async def health_check(self) -> bool:
        """
        Lightweight connectivity check — sends a minimal message to HF.
        Used by the /health endpoint and startup lifespan.
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    HF_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.HF_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model":      settings.HF_MODEL,
                        "messages":   [{"role": "user", "content": "hi"}],
                        "max_tokens": 5,
                    },
                )
            return response.status_code in (200, 201)
        except Exception as exc:
            logger.warning(f"HF health check failed: {type(exc).__name__}: {exc}")
            return False

    def get_stats(self) -> Dict:
        total = self._stats["total_calls"]
        success = self._stats["successful_calls"]
        avg_latency = (
            round(self._stats["total_latency_ms"] / success, 2)
            if success > 0 else 0
        )
        return {
            "total_calls":     total,
            "successful_calls": success,
            "failed_calls":    self._stats["failed_calls"],
            "success_rate":    f"{round(success / total * 100, 1)}%" if total > 0 else "N/A",
            "avg_latency_ms":  avg_latency,
            "model":           settings.HF_MODEL,
        }

hf_service = HuggingFaceService()