from pydantic import BaseModel, Field
from datetime import date as Date, time as Time, datetime
from typing import Optional, List

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class InteractionCreate(BaseModel):
    hcp_id: int
    interaction_type: Optional[str] = None
    date: Optional[Date] = None
    time: Optional[Time] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None

class InteractionUpdate(BaseModel):
    interaction_type: Optional[str] = None
    date: Optional[Date] = None
    time: Optional[Time] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None

class InteractionResponse(BaseModel):
    id: int
    hcp_id: int
    interaction_type: Optional[str] = None
    date: Optional[Date] = None
    time: Optional[Time] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class HCPCreate(BaseModel):
    name: str
    hospital: Optional[str] = None
    specialization: Optional[str] = None
    last_met: Optional[Date] = None
    notes: Optional[str] = None

class HCPResponse(BaseModel):
    id: int
    name: str
    hospital: Optional[str] = None
    specialization: Optional[str] = None
    last_met: Optional[Date] = None
    notes: Optional[str] = None
    interactions: List[InteractionResponse] = []

    class Config:
        from_attributes = True

# Schema for structured output of LLM logging interaction
class ExtractedInteraction(BaseModel):
    hcp_name: str = Field(description="The name of the Doctor / Healthcare Professional (HCP)")
    interaction_type: Optional[str] = Field(None, description="Type of interaction, e.g., Call, Email, In-Person, Video Conference")
    date: Optional[Date] = Field(None, description="Date of the interaction in YYYY-MM-DD format")
    time: Optional[Time] = Field(None, description="Time of the interaction in HH:MM format")
    attendees: Optional[str] = Field(None, description="List of attendees as a comma-separated string")
    topics_discussed: Optional[str] = Field(None, description="Topics discussed as a comma-separated string")
    materials_shared: Optional[str] = Field(None, description="Materials shared as a comma-separated string")
    samples_distributed: Optional[str] = Field(None, description="Samples distributed as a comma-separated string")
    sentiment: Optional[str] = Field(None, description="Sentiment of the interaction: Positive, Neutral, or Negative")
    outcomes: Optional[str] = Field(None, description="Outcomes or summary of the interaction")
    follow_up_actions: Optional[str] = Field(None, description="Follow-up actions or next steps")
