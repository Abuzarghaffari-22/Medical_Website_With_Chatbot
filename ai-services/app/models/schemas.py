from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

class IntentType(str, Enum):
    FAQ_HOURS          = "faq_hours"
    FAQ_LOCATION       = "faq_location"
    FAQ_SERVICES       = "faq_services"
    FAQ_CONTACT        = "faq_contact"
    FAQ_PRICING        = "faq_pricing"
    FAQ_INSURANCE      = "faq_insurance"
    SYMPTOM_QUERY      = "symptom_query"
    APPOINTMENT_REQUEST = "appointment_request"
    EMERGENCY_QUERY    = "emergency_query"
    GREETING           = "greeting"
    FAREWELL           = "farewell"
    GENERAL_MEDICAL    = "general_medical"
    OUT_OF_SCOPE       = "out_of_scope"
    UNKNOWN            = "unknown"

class UrgencyLevel(str, Enum):
    EMERGENCY  = "emergency"    # Call 911 / Go to ER immediately
    URGENT     = "urgent"       # See doctor today / within 24 hrs
    SEMI_URGENT = "semi_urgent" # See doctor within 2–3 days
    NON_URGENT = "non_urgent"   # Schedule routine appointment
    SELF_CARE  = "self_care"    # Can manage at home
    UNKNOWN    = "unknown"

class MessageRole(str, Enum):
    USER      = "user"
    ASSISTANT = "assistant"
    SYSTEM    = "system"

class ConversationMessage(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1, max_length=5000)
    timestamp: Optional[datetime] = None

    model_config = {"use_enum_values": True}

class SymptomAnalysis(BaseModel):
    detected_symptoms: List[str]   = Field(default_factory=list)
    possible_conditions: List[str] = Field(default_factory=list)
    urgency_level: UrgencyLevel    = UrgencyLevel.UNKNOWN
    urgency_reasoning: str         = ""
    recommended_action: str        = ""
    red_flags: List[str]           = Field(default_factory=list)
    triage_score: int              = Field(default=0, ge=0, le=10)

class IntentAnalysis(BaseModel):
    primary_intent: IntentType
    confidence: float           = Field(default=0.0, ge=0.0, le=1.0)
    secondary_intents: List[IntentType] = Field(default_factory=list)
    entities: Dict              = Field(default_factory=dict)

class ChatRequest(BaseModel):
    user_id: str    = Field(..., min_length=1, max_length=100)
    session_id: str = Field(..., min_length=1, max_length=100)
    message: str    = Field(..., min_length=1, max_length=2000)
    conversation_history: List[ConversationMessage] = Field(
        default_factory=list, max_length=20
    )
    user_context: Optional[Dict] = Field(default_factory=dict)

    @field_validator("message", mode="before")
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("message must be a string")
        v = v.strip().replace("\x00", "").replace("\r", "")
        if not v:
            raise ValueError("message cannot be empty or whitespace-only")
        return v

    @field_validator("user_context", mode="before")
    @classmethod
    def sanitize_user_context(cls, v):
        if v is None:
            return {}
        if not isinstance(v, dict):
            raise ValueError("user_context must be a JSON object")
        if len(str(v)) > 2000:
            raise ValueError("user_context exceeds maximum allowed size (2000 chars)")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_id": "user_123",
                "session_id": "sess_abc456",
                "message": "I've been having a headache and fever for 2 days",
                "conversation_history": [],
                "user_context": {"name": "John", "age": 35},
            }
        }
    }

class ChatResponse(BaseModel):
    success: bool              = True
    session_id: str
    response: str
    intent: IntentAnalysis
    symptom_analysis: Optional[SymptomAnalysis] = None
    disclaimer: Optional[str]  = None
    quick_replies: List[str]   = Field(default_factory=list)
    metadata: Dict             = Field(default_factory=dict)

class IntentRequest(BaseModel):
    message: str            = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = Field(default=None, max_length=100)

    @field_validator("message", mode="before")
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        return v.strip().replace("\x00", "") if isinstance(v, str) else v

class IntentResponse(BaseModel):
    success: bool             = True
    intent: IntentAnalysis
    processing_time_ms: Optional[float] = None

class SymptomRequest(BaseModel):
    symptoms: List[str]              = Field(..., min_length=1, max_length=20)
    patient_context: Optional[Dict]  = Field(default_factory=dict)

    @field_validator("symptoms", mode="before")
    @classmethod
    def validate_symptoms(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one symptom is required")
        cleaned = [s.strip() for s in v if isinstance(s, str) and s.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty symptom string is required")
        return cleaned[:20]

class SymptomResponse(BaseModel):
    success: bool              = True
    analysis: SymptomAnalysis
    follow_up_questions: List[str] = Field(default_factory=list)
    processing_time_ms: Optional[float] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    hf_status: str
    model: str
    uptime_seconds: float

class LivenessResponse(BaseModel):
    status: str

class ReadinessResponse(BaseModel):
    status: str
    checks: Dict

class ErrorResponse(BaseModel):
    success: bool          = False
    error: str
    message: str
    details: Optional[Dict] = None