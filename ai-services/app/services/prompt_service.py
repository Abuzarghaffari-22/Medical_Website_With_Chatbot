from typing import Dict, List, Optional

from app.models.schemas import (
    ConversationMessage, IntentAnalysis, IntentType,
    SymptomAnalysis, UrgencyLevel,
)
from app.core.config import settings

MEDICAL_DISCLAIMER = (
    "⚠️ **Medical Disclaimer:** This information is for general educational purposes only "
    "and does not constitute professional medical advice, diagnosis, or treatment. "
    "Always consult a qualified healthcare provider for any medical concerns."
)

SYMPTOM_DISCLAIMER = (
    "⚠️ **Important:** The symptom information provided is for general guidance only. "
    "Only a qualified medical professional can properly diagnose and treat medical conditions. "
    "Please consult a doctor for an accurate evaluation."
)

EMERGENCY_DISCLAIMER = (
    "🚨 **EMERGENCY NOTICE:** If you are experiencing a life-threatening emergency, "
    "please call 911 or go to your nearest Emergency Room immediately. "
    "Do not rely on this chat for emergency medical guidance."
)

def build_system_prompt(
    intent: IntentAnalysis,
    symptom_analysis: Optional[SymptomAnalysis] = None,
) -> str:
    c = settings
    base = f"""You are MediBot, an AI health assistant for {c.CLINIC_NAME}.
You are professional, empathetic, accurate, and always prioritise patient safety.

CLINIC INFORMATION:
• Name: {c.CLINIC_NAME}
• Phone: {c.CLINIC_PHONE}
• Email: {c.CLINIC_EMAIL}
• Address: {c.CLINIC_ADDRESS}
• Hours: {c.CLINIC_HOURS}
• Emergency: {c.CLINIC_EMERGENCY}

ABSOLUTE RULES — NEVER VIOLATE:
1. NEVER definitively diagnose — say "this could suggest X" not "you have X"
2. ALWAYS recommend professional medical consultation for any health concern
3. For emergencies, ALWAYS direct to 911 / nearest ER as your FIRST instruction
4. NEVER recommend specific prescription medications by name
5. NEVER guarantee pricing, wait times, or treatment outcomes
6. Be compassionate — patients may be anxious or in distress
7. Keep responses concise and actionable (under 300 words unless detail is needed)
8. Use markdown: headers, bullet points, bold for key info
9. Always offer to help book an appointment or provide clinic contact info
10. Respond ONLY in English unless the patient writes in another language
"""
    return base + "\n" + _get_intent_instructions(intent.primary_intent, symptom_analysis)

def _get_intent_instructions(
    intent: IntentType,
    symptom_analysis: Optional[SymptomAnalysis] = None,
) -> str:
    if intent == IntentType.EMERGENCY_QUERY:
        return """
CURRENT MODE: EMERGENCY RESPONSE
- Open IMMEDIATELY with: "🚨 This sounds like a potential emergency."
- Direct to 911 / nearest ER as your VERY FIRST instruction — before anything else
- Do NOT engage in long conversation — clarity and urgency take priority
- Provide clinic emergency contact as secondary option only
- Keep response under 120 words
"""

    if intent == IntentType.SYMPTOM_QUERY:
        urgency_note = ""
        if symptom_analysis and symptom_analysis.urgency_level != UrgencyLevel.UNKNOWN:
            urgency_note = (
                f"\nPre-assessed urgency: {symptom_analysis.urgency_level.value} "
                f"(triage score: {symptom_analysis.triage_score}/10)"
            )
        return f"""
CURRENT MODE: SYMPTOM ASSESSMENT{urgency_note}

Structure your response:
1. **Empathetic acknowledgment** of the patient's symptoms
2. **General educational information** (not a diagnosis)
3. **Possible considerations** — use "this could suggest X", never "you have X"
4. **Urgency & recommended action** based on triage level
5. **Medical disclaimer** (always include)
6. **Offer to book appointment** or provide clinic contact
"""

    if intent == IntentType.FAQ_HOURS:
        return """CURRENT MODE: CLINIC HOURS\n- Present hours clearly\n- Mention to call ahead for holiday schedules\n- Offer to book an appointment\n"""

    if intent == IntentType.FAQ_LOCATION:
        return """CURRENT MODE: LOCATION/DIRECTIONS\n- Present clinic address clearly\n- Suggest calling for specific directions\n- Mention parking/accessibility\n"""

    if intent == IntentType.FAQ_SERVICES:
        return """CURRENT MODE: SERVICES FAQ\n- List services with bullet points\n- Note to call to confirm specialist availability\n- Offer to help book\n"""

    if intent == IntentType.FAQ_CONTACT:
        return """CURRENT MODE: CONTACT INFORMATION\n- Present all contact details in a formatted block\n- Mention preferred channel for appointments vs urgent queries\n"""

    if intent == IntentType.FAQ_PRICING:
        return """CURRENT MODE: PRICING\n- Explain pricing varies by service and insurance\n- Do NOT quote specific prices — direct to billing team\n- Mention most major insurance plans are accepted\n"""

    if intent == IntentType.FAQ_INSURANCE:
        return """CURRENT MODE: INSURANCE\n- Say "most major plans" are accepted\n- Direct to billing team to verify specific coverage\n- Mention self-pay options exist\n"""

    if intent == IntentType.APPOINTMENT_REQUEST:
        return """CURRENT MODE: APPOINTMENT\n- Confirm you can help book\n- Explain: via phone or clinic website\n- Ask for reason for visit if not provided\n- Mention typical availability\n"""

    if intent == IntentType.GREETING:
        return """CURRENT MODE: GREETING\n- Greet warmly and professionally\n- Introduce yourself as MediBot\n- Ask how you can help\n- Keep to 2–3 sentences\n"""

    if intent == IntentType.FAREWELL:
        return """CURRENT MODE: FAREWELL\n- Say goodbye warmly\n- Remind them the clinic is always available\n- Wish them good health\n- Keep to 2–3 sentences\n"""

    return """CURRENT MODE: GENERAL\n- If medical: provide general educational info\n- If out of scope: politely explain what MediBot can help with\n- Redirect to booking if query involves personal health\n"""

def build_conversation_messages(
    system_prompt: str,
    conversation_history: List[ConversationMessage],
    current_message: str,
    max_history: Optional[int] = None,
) -> List[Dict[str, str]]:
    if max_history is None:
        max_history = settings.MAX_CONVERSATION_HISTORY

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for msg in conversation_history[-max_history:]:
        role = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
        if role in {"user", "assistant"}:
            messages.append({"role": role, "content": msg.content})

    messages.append({"role": "user", "content": current_message})
    return messages

FAQ_RESPONSES: Dict[IntentType, callable] = {
    IntentType.FAQ_HOURS: lambda: (
        f"📅 **{settings.CLINIC_NAME} — Office Hours**\n\n"
        f"{settings.CLINIC_HOURS}\n\n"
        f"We're closed on major public holidays. "
        f"For the most up-to-date schedule, call us at **{settings.CLINIC_PHONE}**.\n\n"
        f"Would you like to book an appointment? I can help with that! 😊"
    ),
    IntentType.FAQ_LOCATION: lambda: (
        f"📍 **Our Location**\n\n"
        f"**{settings.CLINIC_NAME}**\n"
        f"{settings.CLINIC_ADDRESS}\n\n"
        f"📞 For specific directions: **{settings.CLINIC_PHONE}**\n\n"
        f"✅ Wheelchair-accessible entrance available.\n"
        f"✅ On-site parking available.\n"
        f"✅ Accessible by public transport.\n\n"
        f"Would you like to book an appointment?"
    ),
    IntentType.FAQ_CONTACT: lambda: (
        f"📞 **Contact {settings.CLINIC_NAME}**\n\n"
        f"• **Phone:** {settings.CLINIC_PHONE}\n"
        f"• **Email:** {settings.CLINIC_EMAIL}\n"
        f"• **Address:** {settings.CLINIC_ADDRESS}\n"
        f"• **Hours:** {settings.CLINIC_HOURS}\n\n"
        f"🚨 **Emergency:** {settings.CLINIC_EMERGENCY}\n\n"
        f"Is there anything specific I can help you with today?"
    ),
}

_QUICK_REPLIES: Dict[IntentType, List[str]] = {
    IntentType.GREETING:             ["Book an appointment", "Clinic hours", "Our services", "Symptom checker"],
    IntentType.SYMPTOM_QUERY:        ["Book appointment now", "Speak to a nurse", "Describe more symptoms", "Clinic location"],
    IntentType.APPOINTMENT_REQUEST:  ["Morning slot", "Afternoon slot", "Cancel/Reschedule", "Available doctors"],
    IntentType.FAQ_HOURS:            ["Book appointment", "Get directions", "Contact us", "Services offered"],
    IntentType.FAQ_LOCATION:         ["Book appointment", "Contact us", "Opening hours", "Parking info"],
    IntentType.FAQ_SERVICES:         ["Book appointment", "Pricing info", "Contact us", "Clinic hours"],
    IntentType.FAQ_PRICING:          ["Book appointment", "Insurance info", "Contact billing", "Clinic hours"],
    IntentType.FAQ_INSURANCE:        ["Book appointment", "Pricing info", "Contact billing", "Self-pay options"],
    IntentType.EMERGENCY_QUERY:      ["Call 911", "Nearest ER", "Clinic phone", "I'm safe now"],
    IntentType.FAREWELL:             ["Actually, I have a question", "Book appointment", "Contact clinic"],
    IntentType.GENERAL_MEDICAL:      ["Book appointment", "Symptom checker", "Contact clinic", "Clinic hours"],
}

_DEFAULT_QUICK_REPLIES = ["Book appointment", "Clinic hours", "Contact us", "Symptom check"]

def get_quick_replies(intent: IntentType) -> List[str]:
    return _QUICK_REPLIES.get(intent, _DEFAULT_QUICK_REPLIES)