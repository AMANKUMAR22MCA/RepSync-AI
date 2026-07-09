import os
import json
from datetime import datetime, date, time
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from langchain_core.tools import tool
from langchain_groq import ChatGroq

from database import SessionLocal
from models import HCP, Interaction

load_dotenv()

# Ensure some dummy key is set if not present in the environment
# to allow importing modules and running tests without immediately crashing on key verification.
if not os.getenv("GROQ_API_KEY"):
    os.environ["GROQ_API_KEY"] = "dummy_key_for_import_and_compilation"

# Initialize LLM
# Model specified in requirements: llama-3.3-70b-versatile
llm = ChatGroq(model_name="llama-3.3-70b-versatile")

def safe_json_parse(text: str) -> dict:
    """Helper to strip markdown backticks and parse JSON safely."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback if LLM produced invalid JSON but we can find braces
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end+1])
            except json.JSONDecodeError:
                pass
        raise ValueError(f"Failed to parse JSON from LLM response: {text}")

# Tool 1: get_hcp_profile
@tool
def get_hcp_profile(name: str) -> str:
    """Search HCP table by name. Returns the HCP's profile and entire interaction history as a JSON string."""
    with SessionLocal() as db:
        # Search for doctor matching name (case-insensitive fuzzy match)
        hcp = db.query(HCP).filter(HCP.name.ilike(f"%{name}%")).first()
        if not hcp:
            return json.dumps({"error": f"HCP with name '{name}' not found."})
        
        # Serialize interactions
        interactions_list = []
        for i in hcp.interactions:
            interactions_list.append({
                "id": i.id,
                "interaction_type": i.interaction_type,
                "date": str(i.date) if i.date else None,
                "time": str(i.time) if i.time else None,
                "attendees": i.attendees,
                "topics_discussed": i.topics_discussed,
                "materials_shared": i.materials_shared,
                "samples_distributed": i.samples_distributed,
                "sentiment": i.sentiment,
                "outcomes": i.outcomes,
                "follow_up_actions": i.follow_up_actions,
                "created_at": i.created_at.isoformat() if i.created_at else None
            })
            
        profile = {
            "id": hcp.id,
            "name": hcp.name,
            "hospital": hcp.hospital,
            "specialization": hcp.specialization,
            "last_met": str(hcp.last_met) if hcp.last_met else None,
            "notes": hcp.notes,
            "interactions": interactions_list
        }
        return json.dumps(profile, indent=2)

# Tool 6: create_hcp
@tool
def create_hcp(name: str, hospital: str, specialization: str, notes: str = "") -> str:
    """Creates a new HCP/Doctor profile in the database.
    Use when user mentions a doctor not in system.
    Always call this BEFORE log_interaction for unknown doctors.
    """
    with SessionLocal() as db:
        existing = db.query(HCP).filter(
            HCP.name.ilike(f"%{name}%")
        ).first()
        if existing:
            return json.dumps({"message": f"{name} already exists", "id": existing.id})
        new_hcp = HCP(
            name=name,
            hospital=hospital,
            specialization=specialization,
            notes=notes
        )
        db.add(new_hcp)
        db.commit()
        db.refresh(new_hcp)
        return json.dumps({
            "message": "Created successfully!",
            "id": new_hcp.id,
            "name": new_hcp.name,
            "hospital": new_hcp.hospital,
            "specialization": new_hcp.specialization
        })

# Tool 2: log_interaction
@tool
def log_interaction(data: str) -> str:
    """Extracts interaction details from a natural language input using LLM, saves it to the database, and returns the structured JSON."""
    # Construct prompt for structured extraction
    # Standard date reference is 2026-07-09 (Today's date: Thu Jul 09 2026)
    prompt = f"""
    You are an AI assistant designed to extract structured information from a pharma sales representative's notes.
    Extract details from the interaction notes below.
    
    CRITICAL: Today's date is Thursday, July 09, 2026. Relative dates like "yesterday", "today", "last Friday" must be resolved relative to July 09, 2026.
    
    Output MUST be a single, valid JSON object and absolutely nothing else. No explanation, no backticks, no text before or after the JSON.
    Use this exact JSON structure:
    {{
      "hcp_name": "The Doctor's name (e.g., 'Dr. Richard Patel' or 'Dr. Patel')",
      "interaction_type": "Meeting, Call, Email, Video Conference",
      "date": "YYYY-MM-DD format (resolve relative terms based on 2026-07-09)",
      "time": "HH:MM format",
      "attendees": "Comma-separated list of attendees",
      "topics_discussed": "Comma-separated list of topics discussed",
      "materials_shared": "Comma-separated list of materials or slides shared",
      "samples_distributed": "Comma-separated list of product samples given",
      "sentiment": "Positive, Neutral, or Negative",
      "outcomes": "Detailed outcomes or findings of the interaction",
      "follow_up_actions": "Any follow-up actions or next steps"
    }}

    Notes to parse:
    "{data}"
    """
    
    try:
        response = llm.invoke(prompt)
        extracted = safe_json_parse(response.content)
    except Exception as e:
        return json.dumps({"error": f"Failed to extract information from notes: {str(e)}"})
    
    hcp_name = extracted.get("hcp_name") or "Unknown Doctor"

    # Generate follow-up suggestions automatically
    try:
        followup_prompt = f"""
        You are an expert pharmaceutical CRM assistant.

        Based on the following interaction details, suggest exactly 3 professional
        follow-up actions for the sales representative.

        Topics Discussed:
        {extracted.get("topics_discussed")}

        Sentiment:
        {extracted.get("sentiment")}

        Outcomes:
        {extracted.get("outcomes")}

        Return ONLY a comma-separated list of actions.
        Example:
        Schedule follow-up meeting in 2 weeks, Share efficacy study data, Send product brochure
        """

        followup_response = llm.invoke(followup_prompt)
        generated_followups = followup_response.content.strip()

    except Exception:
        generated_followups = extracted.get("follow_up_actions", "")
    
    with SessionLocal() as db:
        # Check if HCP exists
        hcp = db.query(HCP).filter(HCP.name.ilike(f"%{hcp_name}%")).first()
        if not hcp:
            # If Doctor doesn't exist, create a default doctor so the logging doesn't fail
            hcp = HCP(
                name=hcp_name,
                hospital="Unknown Hospital",
                specialization="General Medicine",
                last_met=date.today(),
                notes="Automatically created during interaction logging."
            )
            db.add(hcp)
            db.commit()
            db.refresh(hcp)
            
        # Parse date and time safely
        parsed_date = None
        if extracted.get("date"):
            try:
                parsed_date = datetime.strptime(extracted["date"], "%Y-%m-%d").date()
            except ValueError:
                pass
                
        parsed_time = None
        if extracted.get("time"):
            try:
                # support both HH:MM and HH:MM:SS
                time_str = extracted["time"]
                if len(time_str.split(":")) == 2:
                    parsed_time = datetime.strptime(time_str, "%H:%M").time()
                else:
                    parsed_time = datetime.strptime(time_str, "%H:%M:%S").time()
            except ValueError:
                pass

        # Create interaction
        interaction = Interaction(
            hcp_id=hcp.id,
            interaction_type=extracted.get("interaction_type"),
            date=parsed_date,
            time=parsed_time,
            attendees=extracted.get("attendees"),
            topics_discussed=extracted.get("topics_discussed"),
            materials_shared=extracted.get("materials_shared"),
            samples_distributed=extracted.get("samples_distributed"),
            sentiment=extracted.get("sentiment"),
            outcomes=extracted.get("outcomes"),
            follow_up_actions=generated_followups  #← use the AI generated ones!
        )
        db.add(interaction)
        
        # Also update doctor's last_met and notes if we logged a newer date
        if parsed_date:
            if not hcp.last_met or parsed_date > hcp.last_met:
                hcp.last_met = parsed_date
        
        db.commit()
        db.refresh(interaction)
        
        result = {
            "id": interaction.id,
            "hcp_id": hcp.id,
            "hcp_name": hcp.name,
            "interaction_type": interaction.interaction_type,
            "date": str(interaction.date) if interaction.date else None,
            "time": str(interaction.time) if interaction.time else None,
            "attendees": interaction.attendees,
            "topics_discussed": interaction.topics_discussed,
            "materials_shared": interaction.materials_shared,
            "samples_distributed": interaction.samples_distributed,
            "sentiment": interaction.sentiment,
            "outcomes": interaction.outcomes,
            "follow_up_actions": interaction.follow_up_actions,
            "created_at": interaction.created_at.isoformat() if interaction.created_at else None
        }
        return json.dumps(result, indent=2)

# Tool 3: analyze_sentiment
@tool
def analyze_sentiment(text: str) -> str:
    """Analyzes the sentiment of the provided text, returning Positive, Neutral, or Negative with a clear reason."""
    prompt = f"""
    Analyze the sentiment of the following interaction text.
    Return a JSON object with EXACTLY these fields:
    {{
      "sentiment": "Positive" or "Neutral" or "Negative",
      "reason": "Short explanation for this sentiment classification"
    }}
    Output ONLY valid JSON. No explanation, no preamble, no markdown formatting outside of JSON.
    
    Text: "{text}"
    """
    try:
        response = llm.invoke(prompt)
        parsed = safe_json_parse(response.content)
        return json.dumps(parsed, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Sentiment analysis failed: {str(e)}"})

# Tool 4: suggest_followup
@tool
def suggest_followup(topics: str, sentiment: str, hcp_profile: str) -> str:
    """Uses LLM to generate exactly 3 highly customized follow-up action suggestions based on topics, sentiment, and HCP profile."""
    prompt = f"""
    Based on the following interaction details and HCP profile, suggest exactly 3 clear, actionable, professional follow-up actions a pharma representative should take.
    
    Topics Discussed: {topics}
    Sentiment of Interaction: {sentiment}
    HCP Profile Context: {hcp_profile}
    
    Return a JSON object with EXACTLY this field:
    {{
      "suggestions": [
        "First specific action suggestion.",
        "Second specific action suggestion.",
        "Third specific action suggestion."
      ]
    }}
    Output ONLY valid JSON. No preambles, explanation, or markdown formatting.
    """
    try:
        response = llm.invoke(prompt)
        parsed = safe_json_parse(response.content)
        return json.dumps(parsed, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Follow-up suggestions failed: {str(e)}"})

# Tool 5: edit_interaction
@tool
def edit_interaction(interaction_id: str, field: str, new_value: str) -> str:
    """Updates a specific field in the Interaction table and returns the updated record.
    The field parameter must match one of the interaction table column names:
    interaction_type, date, time, attendees, topics_discussed, materials_shared, samples_distributed, sentiment, outcomes, follow_up_actions.
    """
    try:
        if str(interaction_id).lower() in ["latest", "last", "recent", "new", "current"]:
            with SessionLocal() as db:
                latest = db.query(Interaction)\
                           .order_by(Interaction.id.desc())\
                           .first()
                if not latest:
                    return json.dumps({"error": "No interactions found in database"})
                interaction_id = latest.id
        else:
            interaction_id = int(interaction_id)
    except ValueError:
        return json.dumps({"error": f"Invalid interaction_id: {interaction_id}"})
    allowed_fields = [
        "interaction_type", "date", "time", "attendees", "topics_discussed",
        "materials_shared", "samples_distributed", "sentiment", "outcomes", "follow_up_actions"
    ]
    if field not in allowed_fields:
        return json.dumps({"error": f"Field '{field}' is not editable. Allowed fields: {', '.join(allowed_fields)}"})
        
    with SessionLocal() as db:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return json.dumps({"error": f"Interaction with ID {interaction_id} not found."})
            
        try:
            if field == "date":
                # Convert date string
                interaction.date = datetime.strptime(new_value, "%Y-%m-%d").date()
            elif field == "time":
                # Convert time string
                if len(new_value.split(":")) == 2:
                    interaction.time = datetime.strptime(new_value, "%H:%M").time()
                else:
                    interaction.time = datetime.strptime(new_value, "%H:%M:%S").time()
            else:
                setattr(interaction, field, new_value)
                
            db.commit()
            db.refresh(interaction)
            
            # Serialize updated record
            result = {
                "id": interaction.id,
                "hcp_id": interaction.hcp_id,
                "interaction_type": interaction.interaction_type,
                "date": str(interaction.date) if interaction.date else None,
                "time": str(interaction.time) if interaction.time else None,
                "attendees": interaction.attendees,
                "topics_discussed": interaction.topics_discussed,
                "materials_shared": interaction.materials_shared,
                "samples_distributed": interaction.samples_distributed,
                "sentiment": interaction.sentiment,
                "outcomes": interaction.outcomes,
                "follow_up_actions": interaction.follow_up_actions,
                "created_at": interaction.created_at.isoformat() if interaction.created_at else None
            }
            return json.dumps(result, indent=2)
            
        except Exception as e:
            return json.dumps({"error": f"Failed to update field '{field}' to value '{new_value}': {str(e)}"})
