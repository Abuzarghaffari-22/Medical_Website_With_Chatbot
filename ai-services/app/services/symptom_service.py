import logging
from typing import Dict, List, Optional, Tuple

from app.models.schemas import SymptomAnalysis, UrgencyLevel

logger = logging.getLogger(__name__)

_EMERGENCY_SYMPTOMS = {
    "chest pain", "chest tightness", "can't breathe", "difficulty breathing",
    "shortness of breath", "heart attack", "stroke", "seizure", "unconscious",
    "passed out", "severe bleeding", "overdose", "poisoning", "anaphylaxis",
    "allergic reaction severe", "loss of consciousness", "paralysis",
    "sudden numbness", "sudden weakness", "sudden confusion", "sudden vision loss",
    "suicidal", "not breathing",
}

_URGENT_SYMPTOMS = {
    "high fever", "fever over 103", "severe abdominal pain", "severe headache",
    "vomiting blood", "blood in stool", "coughing blood", "broken bone",
    "fracture", "dislocation", "deep cut", "wound", "ear infection severe",
    "eye pain severe", "urinary retention", "kidney pain", "appendix pain",
    "right lower abdomen pain", "jaundice", "yellow skin", "confusion",
    "altered mental status", "severe dehydration", "diabetic emergency",
    "blood sugar very high", "blood sugar very low", "hypoglycemia",
    "severe allergic reaction", "difficulty swallowing",
}

_SEMI_URGENT_SYMPTOMS = {
    "sore throat", "ear pain", "ear ache", "pink eye", "conjunctivitis",
    "mild fever", "fever", "urinary tract infection", "uti", "burning urination",
    "moderate abdominal pain", "back pain", "joint pain", "sprain", "strain",
    "rash", "skin infection", "cough lasting weeks", "bronchitis",
    "sinus infection", "sinusitis", "persistent headache", "migraine",
    "vomiting", "diarrhea", "stomach pain", "nausea persistent",
}

_NON_URGENT_SYMPTOMS = {
    "mild headache", "mild back pain", "mild joint pain", "chronic condition follow-up",
    "prescription refill", "routine checkup", "mild anxiety", "mild depression",
    "insomnia", "fatigue", "tiredness", "constipation", "bloating",
    "mild rash", "acne", "dandruff", "athlete's foot", "mild cold",
}

_SELF_CARE_SYMPTOMS = {
    "runny nose", "sneezing", "mild cough", "sore muscles", "minor cut",
    "minor bruise", "mild sunburn", "hiccups", "mild indigestion",
    "mild heartburn", "mild nausea", "common cold", "congestion",
}

_CONDITION_MAP: List[Tuple[List[str], List[str]]] = [
    (["fever", "cough", "fatigue"], ["Influenza (Flu)", "COVID-19", "Common Cold"]),
    (["fever", "sore throat", "headache"], ["Streptococcal Pharyngitis (Strep Throat)", "Tonsillitis", "Viral Pharyngitis"]),
    (["headache", "stiff neck", "fever"], ["Meningitis (seek immediate care)", "Viral Infection", "Tension Headache"]),
    (["chest pain", "shortness of breath"], ["Cardiac Event (emergency)", "Pulmonary Embolism", "Anxiety/Panic Attack"]),
    (["chest pain", "left arm pain"], ["Myocardial Infarction (Heart Attack — call 911)"]),
    (["abdominal pain", "nausea", "vomiting"], ["Gastroenteritis", "Appendicitis", "Food Poisoning", "GERD"]),
    (["burning urination", "frequent urination"], ["Urinary Tract Infection (UTI)", "Cystitis"]),
    (["runny nose", "sneezing", "congestion"], ["Common Cold", "Allergic Rhinitis", "Sinusitis"]),
    (["fatigue", "weight loss", "night sweats"], ["Possible Systemic Illness — see doctor"]),
    (["joint pain", "swelling", "stiffness"], ["Arthritis", "Gout", "Joint Injury"]),
    (["rash", "itching", "hives"], ["Allergic Reaction", "Contact Dermatitis", "Eczema"]),
    (["dizziness", "headache", "nausea"], ["Migraine", "Labyrinthitis", "Vertigo", "Hypertension"]),
    (["back pain", "leg pain", "numbness"], ["Herniated Disc", "Sciatica", "Muscle Strain"]),
    (["ear pain", "hearing loss", "fever"], ["Otitis Media (Ear Infection)", "Swimmer's Ear"]),
]

_RED_FLAG_PATTERNS: List[Tuple[List[str], str]] = [
    (["headache", "stiff neck", "fever"],       "⚠️ Possible meningitis — seek EMERGENCY care"),
    (["chest pain", "left arm pain"],            "⚠️ Possible heart attack — call 911 immediately"),
    (["chest pain", "shortness of breath"],      "⚠️ Possible cardiac/pulmonary emergency — call 911"),
    (["sudden severe headache"],                 "⚠️ Thunderclap headache — possible brain bleed, call 911"),
    (["facial drooping", "arm weakness"],        "⚠️ Possible stroke — call 911 (FAST protocol)"),
    (["high fever", "rash", "stiff neck"],       "⚠️ Possible meningococcal disease — EMERGENCY"),
    (["vomiting blood"],                         "⚠️ GI bleed — seek emergency care"),
    (["coughing blood"],                         "⚠️ Hemoptysis — seek urgent evaluation"),
    (["severe abdominal pain", "fever"],         "⚠️ Possible appendicitis or peritonitis — seek urgent care"),
]

_FOLLOWUP_MAP: Dict[str, List[str]] = {
    "fever":        ["How high is your temperature?", "How long have you had the fever?", "Are you taking any fever reducers?"],
    "headache":     ["Where exactly is the pain?", "Is it the worst headache of your life?", "Do you have any vision changes?"],
    "chest pain":   ["Does the pain radiate to your arm or jaw?", "Do you have shortness of breath?", "Is the pain crushing or pressure-like?"],
    "cough":        ["Is it a dry or productive cough?", "Any blood in mucus?", "How long have you been coughing?"],
    "abdominal pain": ["Where exactly is the pain?", "Is it constant or comes and goes?", "Any nausea, vomiting, or diarrhea?"],
    "rash":         ["When did it appear?", "Does it itch or burn?", "Have you eaten anything new or used new products?"],
    "dizziness":    ["Is the room spinning or do you feel faint?", "Any hearing changes?", "Did it come on suddenly?"],
    "shortness of breath": ["Can you walk and talk normally?", "Do you have any chest pain?", "Has this happened before?"],
    "default":      ["How long have you had these symptoms?", "Are symptoms getting better or worse?", "Have you had these symptoms before?"],
}

def _normalize(symptom: str) -> str:
    return symptom.lower().strip()

def _symptom_in_set(symptom: str, symptom_set: set) -> bool:
    norm = _normalize(symptom)
    return any(kw in norm or norm in kw for kw in symptom_set)

def _score_severity(symptoms: List[str]) -> Tuple[UrgencyLevel, int, str]:
    """Return (urgency_level, triage_score, reasoning)."""
    if not symptoms:
        return UrgencyLevel.UNKNOWN, 0, "No symptoms provided"

    normed = [_normalize(s) for s in symptoms]

    for s in normed:
        if _symptom_in_set(s, _EMERGENCY_SYMPTOMS):
            return UrgencyLevel.EMERGENCY, 10, f"'{s}' requires immediate emergency care"

    for s in normed:
        if _symptom_in_set(s, _URGENT_SYMPTOMS):
            return UrgencyLevel.URGENT, 8, f"'{s}' requires same-day medical attention"

    for s in normed:
        if _symptom_in_set(s, _SEMI_URGENT_SYMPTOMS):
            return UrgencyLevel.SEMI_URGENT, 5, f"'{s}' should be evaluated within 2-3 days"

    for s in normed:
        if _symptom_in_set(s, _NON_URGENT_SYMPTOMS):
            return UrgencyLevel.NON_URGENT, 3, f"'{s}' can be addressed at a routine appointment"

    for s in normed:
        if _symptom_in_set(s, _SELF_CARE_SYMPTOMS):
            return UrgencyLevel.SELF_CARE, 1, f"'{s}' can typically be managed at home"

    if len(symptoms) >= 2:
        return UrgencyLevel.SEMI_URGENT, 4, "Multiple symptoms — recommend evaluation"

    return UrgencyLevel.NON_URGENT, 2, "Unrecognized symptom — recommend medical evaluation to be safe"

def _apply_age_modifier(
    urgency: UrgencyLevel,
    score: int,
    age: Optional[int],
) -> Tuple[UrgencyLevel, int]:
    """Escalate urgency one level for infants and elderly."""
    if age is None:
        return urgency, score

    _ORDER = [
        UrgencyLevel.SELF_CARE,
        UrgencyLevel.NON_URGENT,
        UrgencyLevel.SEMI_URGENT,
        UrgencyLevel.URGENT,
        UrgencyLevel.EMERGENCY,
    ]

    should_escalate = (age < 3) or (age >= 65)
    if not should_escalate or urgency == UrgencyLevel.EMERGENCY:
        return urgency, score

    current_idx = _ORDER.index(urgency) if urgency in _ORDER else 0
    new_idx = min(current_idx + 1, len(_ORDER) - 1)
    return _ORDER[new_idx], min(score + 2, 10)

def _find_conditions(symptoms: List[str]) -> List[str]:
    """Find possible conditions based on symptom combinations."""
    normed_set = {_normalize(s) for s in symptoms}
    conditions: List[str] = []

    for symptom_combo, possible_conditions in _CONDITION_MAP:
        required = max(1, len(symptom_combo) // 2)
        matches = sum(
            1 for kw in symptom_combo
            if any(kw in ns or ns in kw for ns in normed_set)
        )
        if matches >= required:
            conditions.extend(possible_conditions)

    return list(dict.fromkeys(conditions))[:5]  # Max 5, deduplicated

def _find_red_flags(symptoms: List[str]) -> List[str]:
    """Find dangerous symptom combinations that are red flags."""
    normed_set = {_normalize(s) for s in symptoms}
    flags: List[str] = []

    for symptom_combo, message in _RED_FLAG_PATTERNS:
        if len(symptom_combo) == 1:
            if any(symptom_combo[0] in ns or ns in symptom_combo[0] for ns in normed_set):
                flags.append(message)
        else:
            matches = sum(
                1 for kw in symptom_combo
                if any(kw in ns or ns in kw for ns in normed_set)
            )
            if matches >= len(symptom_combo):
                flags.append(message)

    return flags

def _get_recommended_action(urgency: UrgencyLevel) -> str:
    return {
        UrgencyLevel.EMERGENCY:   "🚨 Call 911 or go to the nearest Emergency Room immediately. Do not drive yourself.",
        UrgencyLevel.URGENT:      "⚠️ Please see a doctor today or visit an urgent care clinic within the next few hours.",
        UrgencyLevel.SEMI_URGENT: "📅 Please schedule an appointment within the next 2-3 days. If symptoms worsen, seek urgent care.",
        UrgencyLevel.NON_URGENT:  "🗓️ Schedule a routine appointment at your convenience. Monitor symptoms for any changes.",
        UrgencyLevel.SELF_CARE:   "🏠 You can likely manage this at home with rest and over-the-counter remedies. See a doctor if symptoms worsen or persist beyond a week.",
        UrgencyLevel.UNKNOWN:     "💊 Please consult a healthcare provider for proper evaluation of your symptoms.",
    }.get(urgency, "Please consult a healthcare provider.")

class SymptomClassifier:

    def classify(
        self,
        symptoms: List[str],
        patient_context: Optional[Dict] = None,
    ) -> SymptomAnalysis:
        """
        Classify symptoms into a triage result.

        Args:
            symptoms: List of symptom strings
            patient_context: Optional dict with 'age', 'gender', etc.

        Returns:
            SymptomAnalysis with urgency level, score, conditions, red flags.
        """
        if not symptoms:
            return SymptomAnalysis(
                detected_symptoms=[],
                possible_conditions=[],
                urgency_level=UrgencyLevel.UNKNOWN,
                urgency_reasoning="No symptoms provided",
                recommended_action="Please describe your symptoms so I can help assess them.",
                red_flags=[],
                triage_score=0,
            )

        cleaned = list(dict.fromkeys(s.strip() for s in symptoms if s.strip()))

        urgency, score, reasoning = _score_severity(cleaned)

        age = None
        if patient_context:
            age_val = patient_context.get("age")
            if isinstance(age_val, (int, float)) and 0 < age_val < 130:
                age = int(age_val)

        urgency, score = _apply_age_modifier(urgency, score, age)

        if age is not None:
            if age < 3:
                reasoning += f" (escalated: infant patient, age {age})"
            elif age >= 65:
                reasoning += f" (escalated: elderly patient, age {age})"

        conditions   = _find_conditions(cleaned)
        red_flags    = _find_red_flags(cleaned)
        action       = _get_recommended_action(urgency)

        logger.info(
            f"Symptom triage | symptoms={cleaned} | urgency={urgency} | score={score}"
        )

        return SymptomAnalysis(
            detected_symptoms=cleaned,
            possible_conditions=conditions,
            urgency_level=urgency,
            urgency_reasoning=reasoning,
            recommended_action=action,
            red_flags=red_flags,
            triage_score=score,
        )

    def get_follow_up_questions(self, symptoms: List[str]) -> List[str]:
        """Generate relevant follow-up questions based on detected symptoms."""
        questions: List[str] = []

        for symptom in symptoms:
            lower = symptom.lower()
            for keyword, qs in _FOLLOWUP_MAP.items():
                if keyword != "default" and keyword in lower:
                    questions.extend(qs)
                    break

        if len(questions) < 2:
            questions.extend(_FOLLOWUP_MAP["default"])

        seen = set()
        unique = []
        for q in questions:
            if q not in seen:
                seen.add(q)
                unique.append(q)

        return unique[:4]

symptom_classifier = SymptomClassifier()