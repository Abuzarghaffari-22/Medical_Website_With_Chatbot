import logging
import time
from typing import Dict, List, Optional

from app.core.config import settings
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    IntentAnalysis,
    IntentType,
    SymptomAnalysis,
    UrgencyLevel,
)
from app.services.huggingface_service import hf_service
from app.services.intent_service import intent_detector
from app.services.symptom_service import symptom_classifier

logger = logging.getLogger(__name__)

_QUICK_REPLIES_EMERGENCY = [
    "Call 911 now", "Find nearest ER", "What are stroke symptoms?",
]
_QUICK_REPLIES_FAQ = [
    "Book an appointment", "What services do you offer?", "What's your phone number?",
]
_QUICK_REPLIES_SYMPTOM = [
    "Is this an emergency?", "Book an appointment", "Get more information",
]
_QUICK_REPLIES_APPOINTMENT = [
    "Check availability", "What documents do I need?", "What are your hours?",
]
_QUICK_REPLIES_GREETING = [
    "Book an appointment", "Check clinic hours", "I have a health concern",
    "Talk to a doctor",
]
_QUICK_REPLIES_DEFAULT = [
    "Book an appointment", "Clinic hours", "Contact us",
]

MEDICAL_DISCLAIMER = (
    "⚕️ This information is for general guidance only and does not constitute "
    "medical advice. Always consult a qualified healthcare provider for diagnosis "
    "and treatment."
)

def _faq_hours_response() -> str:
    return (
        f"Our clinic hours are:\n\n"
        f"🕐 {settings.CLINIC_HOURS}\n\n"
        f"Need to book an appointment? Call us at {settings.CLINIC_PHONE} "
        f"or email {settings.CLINIC_EMAIL}. We look forward to seeing you!"
    )

def _faq_location_response() -> str:
    return (
        f"We're located at:\n\n"
        f"📍 {settings.CLINIC_ADDRESS}\n\n"
        f"Our hours are: {settings.CLINIC_HOURS}\n"
        f"For directions or more info, call us at {settings.CLINIC_PHONE}."
    )

def _faq_contact_response() -> str:
    return (
        f"Here's how to reach us:\n\n"
        f"📞 Phone: {settings.CLINIC_PHONE}\n"
        f"📧 Email: {settings.CLINIC_EMAIL}\n"
        f"📍 Address: {settings.CLINIC_ADDRESS}\n"
        f"⏰ Hours: {settings.CLINIC_HOURS}\n\n"
        f"We're always happy to help!"
    )

def _emergency_response() -> str:
    return (
        f"🚨 **EMERGENCY DETECTED**\n\n"
        f"If you or someone else is in immediate danger, **call 911 now**.\n\n"
        f"For cardiac or stroke emergencies, every second counts. Do not wait.\n\n"
        f"🏥 Go to your nearest Emergency Room immediately.\n\n"
        f"If this is not life-threatening and you need our clinic:\n"
        f"📞 {settings.CLINIC_PHONE}\n"
        f"📍 {settings.CLINIC_ADDRESS}\n\n"
        f"{settings.CLINIC_EMERGENCY}"
    )

def _greeting_response() -> str:
    return (
        f"Hello! 👋 Welcome to {settings.CLINIC_NAME}. I'm MediBot, your AI health assistant.\n\n"
        f"I can help you with:\n"
        f"• 📅 Booking appointments\n"
        f"• 🏥 Clinic hours, location, and services\n"
        f"• 💊 General health questions and symptom guidance\n"
        f"• 📞 Contacting our team\n\n"
        f"What can I help you with today?"
    )

def _farewell_response() -> str:
    return (
        f"Thank you for visiting {settings.CLINIC_NAME}! Take care and stay healthy. "
        f"If you ever need us, we're here at {settings.CLINIC_PHONE}. 💙"
    )

def _build_symptom_context(symptoms: List[str], analysis: SymptomAnalysis) -> str:
    """Build a context string to inject into the HF prompt for symptom queries."""
    lines = [
        f"[MEDICAL CONTEXT — Symptom Triage Results]",
        f"Detected symptoms: {', '.join(symptoms)}",
        f"Urgency level: {analysis.urgency_level.value.upper()}",
        f"Triage score: {analysis.triage_score}/10",
        f"Reasoning: {analysis.urgency_reasoning}",
        f"Recommended action: {analysis.recommended_action}",
    ]
    if analysis.possible_conditions:
        lines.append(f"Possible conditions: {', '.join(analysis.possible_conditions[:3])}")
    if analysis.red_flags:
        lines.append(f"RED FLAGS: {'; '.join(analysis.red_flags)}")
    lines.append(
        "\nUsing the above triage data, provide an empathetic, clear response to the patient. "
        "Acknowledge their symptoms, explain the urgency level in plain language, "
        "and advise them on next steps. Always recommend professional evaluation."
    )
    return "\n".join(lines)

def _serialise_history(conversation_history) -> List[Dict]:
    """Convert ConversationMessage list to plain dicts for the HF service."""
    result = []
    for msg in conversation_history:
        role    = msg.role if isinstance(msg.role, str) else msg.role.value
        content = msg.content
        if role in ("user", "assistant") and content.strip():
            result.append({"role": role, "content": content})
    return result

class ChatOrchestrator:

    async def process(self, request: ChatRequest) -> ChatResponse:
        """
        Process a chat request through the full pipeline.
        Always returns a ChatResponse — never raises to the caller.
        """
        t0 = time.monotonic()

        logger.info(
            f"Chat | user={request.user_id[:8]} | "
            f"session={request.session_id[:12]} | "
            f"msg_len={len(request.message)}"
        )

        try:
            return await self._process_pipeline(request, t0)
        except Exception as exc:
            logger.error(f"Orchestrator unexpected error: {exc}", exc_info=True)
            # Safe fallback — never let the chat endpoint 500
            elapsed = round((time.monotonic() - t0) * 1000, 2)
            return ChatResponse(
                success=True,
                session_id=request.session_id,
                response=(
                    f"I'm experiencing a brief technical issue. For immediate assistance:\n"
                    f"📞 {settings.CLINIC_PHONE}\n"
                    f"📧 {settings.CLINIC_EMAIL}\n"
                    f"⏰ {settings.CLINIC_HOURS}"
                ),
                intent=IntentAnalysis(
                    primary_intent=IntentType.UNKNOWN,
                    confidence=0.0,
                    secondary_intents=[],
                    entities={},
                ),
                quick_replies=_QUICK_REPLIES_DEFAULT,
                metadata={"processing_time_ms": elapsed, "pipeline": "error_fallback"},
            )

    async def _process_pipeline(self, request: ChatRequest, t0: float) -> ChatResponse:
        message = request.message
        history = _serialise_history(request.conversation_history)
        age     = (request.user_context or {}).get("age")

        intent = intent_detector.detect(message)
        logger.debug(f"Intent: {intent.primary_intent} ({intent.confidence:.2f})")

        if intent.primary_intent == IntentType.EMERGENCY_QUERY:
            elapsed = round((time.monotonic() - t0) * 1000, 2)
            return ChatResponse(
                success=True,
                session_id=request.session_id,
                response=_emergency_response(),
                intent=intent,
                symptom_analysis=None,
                disclaimer=None,
                quick_replies=_QUICK_REPLIES_EMERGENCY,
                metadata={"processing_time_ms": elapsed, "pipeline": "emergency_fast_path"},
            )

        faq_response = self._get_faq_response(intent.primary_intent)
        if faq_response:
            elapsed = round((time.monotonic() - t0) * 1000, 2)
            return ChatResponse(
                success=True,
                session_id=request.session_id,
                response=faq_response,
                intent=intent,
                symptom_analysis=None,
                disclaimer=None,
                quick_replies=_QUICK_REPLIES_FAQ,
                metadata={"processing_time_ms": elapsed, "pipeline": "faq_fast_path"},
            )

        symptom_analysis: Optional[SymptomAnalysis] = None
        extra_context: Optional[str] = None

        if intent.primary_intent == IntentType.SYMPTOM_QUERY or intent.entities.get("symptoms"):
            detected_symptoms = intent.entities.get("symptoms", [])

            if detected_symptoms and settings.ENABLE_SYMPTOM_TRIAGE:
                patient_ctx = dict(request.user_context or {})
                if age:
                    patient_ctx["age"] = age

                symptom_analysis = symptom_classifier.classify(
                    symptoms=detected_symptoms,
                    patient_context=patient_ctx,
                )

                # Emergency escalation via triage
                if symptom_analysis.urgency_level == UrgencyLevel.EMERGENCY:
                    elapsed = round((time.monotonic() - t0) * 1000, 2)
                    return ChatResponse(
                        success=True,
                        session_id=request.session_id,
                        response=_emergency_response(),
                        intent=intent,
                        symptom_analysis=symptom_analysis,
                        disclaimer=MEDICAL_DISCLAIMER,
                        quick_replies=_QUICK_REPLIES_EMERGENCY,
                        metadata={"processing_time_ms": elapsed, "pipeline": "symptom_emergency_escalation"},
                    )

                extra_context = _build_symptom_context(detected_symptoms, symptom_analysis)

        ai_response = await hf_service.chat_completion(
            user_message=message,
            conversation_history=history,
            extra_context=extra_context,
        )

        quick_replies = self._get_quick_replies(intent.primary_intent, symptom_analysis)
        disclaimer    = MEDICAL_DISCLAIMER if symptom_analysis else None
        elapsed       = round((time.monotonic() - t0) * 1000, 2)

        logger.info(
            f"Chat complete | {elapsed}ms | intent={intent.primary_intent} | "
            f"response_len={len(ai_response)}"
        )

        return ChatResponse(
            success=True,
            session_id=request.session_id,
            response=ai_response,
            intent=intent,
            symptom_analysis=symptom_analysis,
            disclaimer=disclaimer,
            quick_replies=quick_replies,
            metadata={
                "processing_time_ms": elapsed,
                "pipeline": "hf_completion",
                "model": settings.HF_MODEL,
                "has_triage": symptom_analysis is not None,
            },
        )

    def _get_faq_response(self, intent: IntentType) -> Optional[str]:
        """Return instant static response for FAQ intents, or None."""
        if intent == IntentType.FAQ_HOURS:
            return _faq_hours_response()
        if intent == IntentType.FAQ_LOCATION:
            return _faq_location_response()
        if intent == IntentType.FAQ_CONTACT:
            return _faq_contact_response()
        if intent == IntentType.GREETING:
            return _greeting_response()
        if intent == IntentType.FAREWELL:
            return _farewell_response()
        return None

    def _get_quick_replies(
        self,
        intent: IntentType,
        symptom_analysis: Optional[SymptomAnalysis],
    ) -> List[str]:
        if symptom_analysis:
            if symptom_analysis.urgency_level in (UrgencyLevel.EMERGENCY, UrgencyLevel.URGENT):
                return _QUICK_REPLIES_EMERGENCY
            return _QUICK_REPLIES_SYMPTOM
        if intent == IntentType.APPOINTMENT_REQUEST:
            return _QUICK_REPLIES_APPOINTMENT
        if intent in (IntentType.FAQ_HOURS, IntentType.FAQ_LOCATION,
                      IntentType.FAQ_CONTACT, IntentType.FAQ_SERVICES,
                      IntentType.FAQ_PRICING, IntentType.FAQ_INSURANCE):
            return _QUICK_REPLIES_FAQ
        return _QUICK_REPLIES_DEFAULT

chat_orchestrator = ChatOrchestrator()