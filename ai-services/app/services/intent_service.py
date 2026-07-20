import logging
import re
from typing import Dict, List, Optional, Tuple

from app.models.schemas import IntentAnalysis, IntentType

logger = logging.getLogger(__name__)

_EMERGENCY_PATTERNS = [
    r"\bchest\s*pain\b",
    r"\bheart\s*attack\b",
    r"\bcan[\'t]*\s*breathe\b",
    r"\bdifficult\w*\s*breath\w*\b",
    r"\bshortness\s*of\s*breath\b",
    r"\bstroke\b",
    r"\bseizure\b",
    r"\bunconscious\b",
    r"\bpassed?\s*out\b",
    r"\bsevere\s*bleeding\b",
    r"\bbad\s*accident\b",
    r"\boverdose\b",
    r"\bsuicid\w*\b",
    r"\bpoisoning\b",
    r"\bcan[\'t]*\s*move\b",
    r"\bparalys\w*\b",
    r"\bsudden\s*(numbness|weakness|confusion|vision\s*loss)\b",
    r"\bdying\b",
    r"\bemergency\b",
    r"\b911\b",
]

_FAQ_HOURS_PATTERNS = [
    r"\bhours?\b", r"\bopen\w*\b", r"\bclos\w*\b", r"\bschedule\b",
    r"\btiming\b", r"\bwhen\b.*\b(open|close|available)\b",
    r"\bworking\s*hours\b", r"\bbusiness\s*hours\b",
]

_FAQ_LOCATION_PATTERNS = [
    r"\bwhere\b", r"\blocation\b", r"\baddress\b", r"\bdirections?\b",
    r"\bfind\s*(you|us|clinic)\b", r"\bhow\s*(to\s*get|do\s*i\s*get)\b",
    r"\bnearby\b", r"\bmap\b",
]

_FAQ_CONTACT_PATTERNS = [
    r"\bcontact\b", r"\bphone\b", r"\bnumber\b", r"\bcall\b",
    r"\bemail\b", r"\breach\b", r"\bget\s*in\s*touch\b", r"\bsupport\b",
]

_FAQ_SERVICES_PATTERNS = [
    r"\bservices?\b", r"\btreat\w*\b", r"\bspecialt\w*\b",
    r"\bwhat\s*do\s*you\s*(offer|provide|do)\b",
    r"\bprocedures?\b", r"\btest\w*\b", r"\blab\b",
    r"\bx.?ray\b", r"\bscan\b", r"\bvaccin\w*\b",
]

_FAQ_PRICING_PATTERNS = [
    r"\bpric\w*\b", r"\bcost\b", r"\bfee\b", r"\bcharge\b",
    r"\bhow\s*much\b", r"\baffordable\b", r"\bexpensive\b",
    r"\bcopay\b", r"\bdeductible\b",
]

_FAQ_INSURANCE_PATTERNS = [
    r"\binsurance\b", r"\bcoverage\b", r"\bmedicaid\b", r"\bmedicare\b",
    r"\baetna\b", r"\bbluecross\b", r"\bhumana\b", r"\bcigna\b",
    r"\bunited\s*health\b", r"\bin.network\b", r"\bout.of.network\b",
    r"\baccept\w*\s*insurance\b",
]

_APPOINTMENT_PATTERNS = [
    r"\bappointment\b", r"\bbook\b", r"\bschedule\s*(a|an|my)?\s*(visit|appointment|consult)\b",
    r"\breserv\w*\b", r"\bsee\s*(a\s*)?(doctor|physician|nurse)\b",
    r"\bvisit\b", r"\bconsultation\b", r"\bcheck.?up\b",
]

_GREETING_PATTERNS = [
    r"^\s*(hi|hey|hello|good\s*(morning|afternoon|evening)|howdy|sup|greetings)\b",
    r"^\s*how\s*are\s*you\b",
    r"^\s*what[\'s]*\s*up\b",
]

_FAREWELL_PATTERNS = [
    r"\b(bye|goodbye|farewell|see\s*you|take\s*care|thanks?\s*(bye|goodbye)?|thank\s*you)\b",
    r"\bthat[\'s]*\s*all\b", r"\bgotta\s*go\b",
]

_SYMPTOM_KEYWORDS = [
    "pain", "ache", "hurt", "sore", "fever", "temperature", "headache",
    "migraine", "cough", "cold", "flu", "nausea", "vomit", "diarrhea",
    "rash", "itch", "swelling", "tired", "fatigue", "dizzy", "dizziness",
    "bleed", "wound", "cut", "infection", "inflammation", "burning",
    "tingling", "numbness", "weakness", "shortness", "congestion", "runny nose",
    "sore throat", "ear pain", "ear ache", "stomach", "abdominal", "chest",
    "back pain", "joint", "muscle", "cramp", "bloat", "constipation", "insomnia",
    "anxiety", "depression", "stress", "bp", "blood pressure", "diabetes",
    "sugar", "cholesterol", "allerg", "asthma", "breathing",
]

_DURATION_PATTERN = re.compile(
    r"\b(\d+)\s*(day|hour|week|month|minute|year)s?\b", re.IGNORECASE
)
_AGE_PATTERN = re.compile(
    r"\b(\d{1,3})\s*(?:year[s]?\s*old|y\.?o\.?)\b", re.IGNORECASE
)

def _matches_any(text: str, patterns: List[str]) -> bool:
    for p in patterns:
        if re.search(p, text, re.IGNORECASE):
            return True
    return False

def _extract_symptoms_from_text(text: str) -> List[str]:
    found = []
    lower = text.lower()
    for kw in _SYMPTOM_KEYWORDS:
        if kw in lower:
            found.append(kw)
    return list(dict.fromkeys(found))  # deduplicate preserving order

def _extract_entities(text: str) -> Dict:
    entities: Dict = {}

    symptoms = _extract_symptoms_from_text(text)
    if symptoms:
        entities["symptoms"] = symptoms

    # Duration
    duration_matches = _DURATION_PATTERN.findall(text)
    if duration_matches:
        entities["duration_mentions"] = [f"{n} {unit}s" for n, unit in duration_matches]

    # Age
    age_match = _AGE_PATTERN.search(text)
    if age_match:
        entities["mentioned_age"] = int(age_match.group(1))

    return entities

class IntentDetector:
    """
    Rule-based intent detector. Zero latency — no AI calls, no model loading.
    Emergency always wins. Otherwise scored by keyword density.
    """

    def detect(self, message: str) -> IntentAnalysis:
        if not message or not message.strip():
            return IntentAnalysis(
                primary_intent=IntentType.UNKNOWN,
                confidence=0.0,
                secondary_intents=[],
                entities={},
            )

        text = message.strip()
        entities = _extract_entities(text)
        scores: Dict[IntentType, float] = {}

        emergency_hits = sum(1 for p in _EMERGENCY_PATTERNS
                             if re.search(p, text, re.IGNORECASE))
        if emergency_hits > 0:
            confidence = min(0.95 + emergency_hits * 0.01, 1.0)
            return IntentAnalysis(
                primary_intent=IntentType.EMERGENCY_QUERY,
                confidence=confidence,
                secondary_intents=[],
                entities=entities,
            )

        def score(patterns: List[str]) -> float:
            hits = sum(1 for p in patterns if re.search(p, text, re.IGNORECASE))
            return min(hits / max(len(patterns), 1) * 2.5, 1.0)

        if _matches_any(text, _GREETING_PATTERNS):
            scores[IntentType.GREETING] = 0.9
        if _matches_any(text, _FAREWELL_PATTERNS):
            scores[IntentType.FAREWELL] = 0.85
        if score(_FAQ_HOURS_PATTERNS) > 0:
            scores[IntentType.FAQ_HOURS] = score(_FAQ_HOURS_PATTERNS)
        if score(_FAQ_LOCATION_PATTERNS) > 0:
            scores[IntentType.FAQ_LOCATION] = score(_FAQ_LOCATION_PATTERNS)
        if score(_FAQ_CONTACT_PATTERNS) > 0:
            scores[IntentType.FAQ_CONTACT] = score(_FAQ_CONTACT_PATTERNS)
        if score(_FAQ_SERVICES_PATTERNS) > 0:
            scores[IntentType.FAQ_SERVICES] = score(_FAQ_SERVICES_PATTERNS)
        if score(_FAQ_PRICING_PATTERNS) > 0:
            scores[IntentType.FAQ_PRICING] = score(_FAQ_PRICING_PATTERNS)
        if score(_FAQ_INSURANCE_PATTERNS) > 0:
            scores[IntentType.FAQ_INSURANCE] = score(_FAQ_INSURANCE_PATTERNS)
        if score(_APPOINTMENT_PATTERNS) > 0:
            scores[IntentType.APPOINTMENT_REQUEST] = score(_APPOINTMENT_PATTERNS)

        symptom_hits = len(_extract_symptoms_from_text(text))
        if symptom_hits > 0:
            scores[IntentType.SYMPTOM_QUERY] = min(0.4 + symptom_hits * 0.15, 1.0)

        if not scores:
            return IntentAnalysis(
                primary_intent=IntentType.UNKNOWN,
                confidence=0.1,
                secondary_intents=[],
                entities=entities,
            )

        sorted_intents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        primary, primary_conf = sorted_intents[0]
        secondary = [intent for intent, _ in sorted_intents[1:4] if _ > 0.2]

        return IntentAnalysis(
            primary_intent=primary,
            confidence=round(primary_conf, 3),
            secondary_intents=secondary,
            entities=entities,
        )

    def is_emergency(self, message: str) -> bool:
        return any(
            re.search(p, message, re.IGNORECASE)
            for p in _EMERGENCY_PATTERNS
        )

    def extract_symptoms(self, message: str) -> List[str]:
        return _extract_symptoms_from_text(message)

intent_detector = IntentDetector()