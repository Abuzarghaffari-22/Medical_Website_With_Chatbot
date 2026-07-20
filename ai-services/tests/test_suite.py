import os
import sys

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

# Env MUST be set before importing the app
os.environ.setdefault("SECRET_KEY",       "test-secret-key-32-characters-long!!")
os.environ.setdefault("HF_TOKEN",         "hf_test_token_placeholder")
os.environ.setdefault("HF_MODEL",         "HuggingFaceH4/zephyr-7b-beta")
os.environ.setdefault("INTERNAL_API_KEY", "test-internal-api-key-min-32-chars!!")
os.environ.setdefault("ENVIRONMENT",      "development")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.models.schemas import IntentType, UrgencyLevel
from app.services.intent_service import intent_detector
from app.services.symptom_service import symptom_classifier

VALID_KEY = "test-internal-api-key-min-32-chars!!"
HEADERS   = {"X-Internal-API-Key": VALID_KEY}

@pytest.fixture
def base_chat_payload():
    return {
        "user_id": "user_test_001", "session_id": "sess_test_001",
        "message": "Hello, what are your clinic hours?",
        "conversation_history": [], "user_context": {},
    }

@pytest.fixture
def symptom_chat_payload():
    return {
        "user_id": "user_test_002", "session_id": "sess_test_002",
        "message": "I have a bad headache and fever for 2 days",
        "conversation_history": [], "user_context": {"age": 35, "name": "John"},
    }

class TestIntentDetection:

    def test_greeting_intent(self):
        r = intent_detector.detect("Hello! Good morning")
        assert r.primary_intent == IntentType.GREETING

    def test_faq_hours_intent(self):
        r = intent_detector.detect("What are your opening hours?")
        assert r.primary_intent == IntentType.FAQ_HOURS

    def test_faq_location_intent(self):
        r = intent_detector.detect("Where is the clinic located?")
        assert r.primary_intent == IntentType.FAQ_LOCATION

    def test_faq_contact_intent(self):
        r = intent_detector.detect("What is your phone number?")
        assert r.primary_intent == IntentType.FAQ_CONTACT

    def test_appointment_intent(self):
        r = intent_detector.detect("I want to book an appointment for tomorrow")
        assert r.primary_intent == IntentType.APPOINTMENT_REQUEST

    def test_symptom_intent(self):
        r = intent_detector.detect("I have a headache and fever since yesterday")
        assert r.primary_intent == IntentType.SYMPTOM_QUERY

    def test_emergency_intent(self):
        r = intent_detector.detect("I have severe chest pain and can't breathe!")
        assert r.primary_intent == IntentType.EMERGENCY_QUERY
        assert r.confidence >= 0.95

    def test_emergency_dominates_appointment(self):
        r = intent_detector.detect("I need to book an appointment but I have chest pain")
        assert r.primary_intent == IntentType.EMERGENCY_QUERY

    def test_is_emergency_true(self):
        assert intent_detector.is_emergency("I'm having a seizure right now") is True

    def test_is_emergency_false(self):
        assert intent_detector.is_emergency("What time do you open?") is False

    def test_farewell_intent(self):
        r = intent_detector.detect("Thanks, goodbye!")
        assert r.primary_intent == IntentType.FAREWELL

    def test_insurance_intent(self):
        r = intent_detector.detect("Do you accept Medicare insurance?")
        assert r.primary_intent == IntentType.FAQ_INSURANCE

    def test_pricing_intent(self):
        r = intent_detector.detect("How much does a consultation cost?")
        assert r.primary_intent == IntentType.FAQ_PRICING

    def test_confidence_always_in_range(self):
        for msg in ["hi", "I have chest pain", "book appointment", "hello I feel sick"]:
            r = intent_detector.detect(msg)
            assert 0.0 <= r.confidence <= 1.0

    def test_entity_extraction_symptoms(self):
        r = intent_detector.detect("I have headache and fever")
        assert "symptoms" in r.entities
        assert len(r.entities["symptoms"]) > 0

    def test_entity_extraction_age(self):
        r = intent_detector.detect("My 5 year old has a fever")
        assert "mentioned_age" in r.entities
        assert r.entities["mentioned_age"] == 5

class TestSymptomClassification:

    def test_emergency_symptoms(self):
        r = symptom_classifier.classify(["chest pain", "can't breathe"])
        assert r.urgency_level == UrgencyLevel.EMERGENCY
        assert r.triage_score >= 9

    def test_urgent_symptoms(self):
        r = symptom_classifier.classify(["high fever", "severe abdominal pain"])
        assert r.urgency_level == UrgencyLevel.URGENT

    def test_semi_urgent_symptoms(self):
        r = symptom_classifier.classify(["sore throat", "ear pain"])
        assert r.urgency_level == UrgencyLevel.SEMI_URGENT

    def test_self_care_symptoms(self):
        r = symptom_classifier.classify(["runny nose", "sneezing"])
        assert r.urgency_level == UrgencyLevel.SELF_CARE

    def test_condition_suggestions(self):
        r = symptom_classifier.classify(["fever", "cough", "fatigue"])
        assert len(r.possible_conditions) > 0
        assert any("flu" in c.lower() or "influenza" in c.lower() or "covid" in c.lower()
                   for c in r.possible_conditions)

    def test_red_flag_meningitis_pattern(self):
        r = symptom_classifier.classify(["headache", "stiff neck", "fever"])
        assert any("meningitis" in f.lower() for f in r.red_flags)

    def test_red_flag_heart_attack(self):
        r = symptom_classifier.classify(["chest pain", "left arm pain"])
        assert any("heart attack" in f.lower() for f in r.red_flags)

    def test_age_modifier_infant(self):
        normal = symptom_classifier.classify(["sore throat"])
        infant = symptom_classifier.classify(["sore throat"], patient_context={"age": 1})
        order  = ["self_care", "non_urgent", "semi_urgent", "urgent", "emergency"]
        idx    = lambda r: order.index(r.urgency_level.value) if r.urgency_level.value in order else -1
        assert idx(infant) >= idx(normal)

    def test_age_modifier_elderly(self):
        normal  = symptom_classifier.classify(["mild fever"])
        elderly = symptom_classifier.classify(["mild fever"], patient_context={"age": 75})
        order   = ["self_care", "non_urgent", "semi_urgent", "urgent", "emergency"]
        idx     = lambda r: order.index(r.urgency_level.value) if r.urgency_level.value in order else -1
        assert idx(elderly) >= idx(normal)

    def test_triage_score_always_in_range(self):
        for symptoms in [["headache"], ["chest pain"], [], ["runny nose"]]:
            r = symptom_classifier.classify(symptoms)
            assert 0 <= r.triage_score <= 10

    def test_empty_symptoms_returns_unknown(self):
        r = symptom_classifier.classify([])
        assert r.urgency_level == UrgencyLevel.UNKNOWN

    def test_recommended_action_not_empty(self):
        r = symptom_classifier.classify(["fever"])
        assert len(r.recommended_action) > 0

    def test_follow_up_questions_returned(self):
        qs = symptom_classifier.get_follow_up_questions(["fever", "headache"])
        assert len(qs) > 0
        assert all(isinstance(q, str) for q in qs)

@pytest.mark.asyncio
class TestSecurity:

    @pytest.fixture
    async def client(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    async def test_chat_missing_key_returns_403(self, client, base_chat_payload):
        r = await client.post("/api/chat/", json=base_chat_payload)
        assert r.status_code == 403

    async def test_chat_wrong_key_returns_403(self, client, base_chat_payload):
        r = await client.post("/api/chat/", json=base_chat_payload,
                              headers={"X-Internal-API-Key": "wrong-key"})
        assert r.status_code == 403

    async def test_intent_missing_key_returns_403(self, client):
        r = await client.post("/api/intent/detect", json={"message": "hello"})
        assert r.status_code == 403

@pytest.mark.asyncio
class TestHealthEndpoints:

    @pytest.fixture
    async def client(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    async def test_liveness(self, client):
        r = await client.get("/api/health/live")
        assert r.status_code == 200
        assert r.json()["status"] == "alive"

    async def test_readiness(self, client):
        r = await client.get("/api/health/ready")
        assert r.status_code == 200
        assert r.json()["status"] == "ready"
        assert "checks" in r.json()

    async def test_full_health_check(self, client):
        with patch(
            "app.services.huggingface_service.HuggingFaceService.health_check",
            new_callable=AsyncMock, return_value=True,
        ):
            r = await client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert "hf_status" in data
        assert "uptime_seconds" in data

@pytest.mark.asyncio
class TestFAQFastPath:

    @pytest.fixture
    async def client(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    @patch("app.services.huggingface_service.HuggingFaceService.chat_completion")
    async def test_hours_faq_no_hf_call(self, mock_hf, client, base_chat_payload):
        base_chat_payload["message"] = "What are your clinic hours?"
        r = await client.post("/api/chat/", json=base_chat_payload, headers=HEADERS)
        mock_hf.assert_not_called()
        assert r.status_code == 200

    @patch("app.services.huggingface_service.HuggingFaceService.chat_completion")
    async def test_location_faq_no_hf_call(self, mock_hf, client, base_chat_payload):
        base_chat_payload["message"] = "Where is the clinic located?"
        r = await client.post("/api/chat/", json=base_chat_payload, headers=HEADERS)
        mock_hf.assert_not_called()
        assert r.status_code == 200

@pytest.mark.asyncio
class TestEmergencyFastPath:

    @pytest.fixture
    async def client(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    @patch("app.services.huggingface_service.HuggingFaceService.chat_completion")
    async def test_emergency_bypasses_hf(self, mock_hf, client):
        payload = {
            "user_id": "u1", "session_id": "s1",
            "message": "I'm having severe chest pain and can't breathe",
            "conversation_history": [],
        }
        r = await client.post("/api/chat/", json=payload, headers=HEADERS)
        mock_hf.assert_not_called()
        assert r.status_code == 200
        data = r.json()
        assert "911" in data["response"] or "Emergency" in data["response"]
        assert data["intent"]["primary_intent"] == IntentType.EMERGENCY_QUERY.value

@pytest.mark.asyncio
class TestFullPipeline:

    @pytest.fixture
    async def client(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    @patch("app.services.huggingface_service.HuggingFaceService.chat_completion")
    async def test_symptom_pipeline_end_to_end(self, mock_hf, client, symptom_chat_payload):
        mock_hf.return_value = (
            "Based on your symptoms, this may be influenza. "
            "Please consult a healthcare provider for an accurate diagnosis."
        )
        r = await client.post("/api/chat/", json=symptom_chat_payload, headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["intent"]["primary_intent"] == IntentType.SYMPTOM_QUERY.value
        assert data["symptom_analysis"] is not None
        assert data["disclaimer"] is not None
        assert len(data["quick_replies"]) > 0
        mock_hf.assert_called_once()

    @patch("app.services.huggingface_service.HuggingFaceService.chat_completion")
    async def test_fallback_on_hf_failure(self, mock_hf, client, base_chat_payload):
        """Service must return 200 with helpful message when HF is down — NOT the helpline message."""
        mock_hf.side_effect = RuntimeError("HuggingFace unavailable")
        base_chat_payload["message"] = "I'm not feeling well today"
        r = await client.post("/api/chat/", json=base_chat_payload, headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 0