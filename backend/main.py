from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime

from database import get_db, Base, engine, SessionLocal
from models import HCP, Interaction
from schemas import (
    ChatRequest,
    InteractionCreate,
    InteractionUpdate,
    InteractionResponse,
    HCPResponse
)
from agent.graph import graph
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# Initialize FastAPI App
app = FastAPI(title="RepSync AI Backend", description="FastAPI Backend for Pharma CRM Application")

# Enable CORS for localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Database Tables if they don't exist
Base.metadata.create_all(bind=engine)

# Seed database on startup
@app.on_event("startup")
def seed_database():
    with SessionLocal() as db:
        if db.query(HCP).count() == 0:
            doctors = [
                HCP(
                    name="Dr. Sarah Jenkins",
                    hospital="St. Jude Medical Center",
                    specialization="Cardiology",
                    last_met=date(2026, 6, 15),
                    notes="Prefers detailed clinical study reports. Very analytical, interested in lipid-lowering trials."
                ),
                HCP(
                    name="Dr. Richard Patel",
                    hospital="Grace Community Hospital",
                    specialization="Pediatrics",
                    last_met=date(2026, 7, 1),
                    notes="Always busy. Best to contact during lunch hours. Interested in child immunization vaccines."
                ),
                HCP(
                    name="Dr. Elena Rostova",
                    hospital="Metro General Hospital",
                    specialization="Oncology",
                    last_met=date(2026, 6, 28),
                    notes="Interested in late-stage immunotherapies. Often attends scientific advisory boards."
                )
            ]
            db.add_all(doctors)
            db.commit()
            print("Successfully seeded 3 fake doctors in HCP table!")

# Helper to serialize message objects for the /chat response
def serialize_message(msg):
    if isinstance(msg, HumanMessage):
        return {"role": "user", "content": msg.content}
    elif isinstance(msg, AIMessage):
        # Handle cases where AIMessage might contain tool calls
        tool_calls = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append({
                    "name": tc["name"],
                    "args": tc["args"],
                    "id": tc["id"]
                })
        return {
            "role": "assistant",
            "content": msg.content,
            "tool_calls": tool_calls if tool_calls else None
        }
    elif isinstance(msg, ToolMessage):
        return {"role": "tool", "content": msg.content, "name": msg.name, "tool_call_id": msg.tool_call_id}
    else:
        # Fallback for general dict or other message types (e.g. system or base)
        role = getattr(msg, "type", "unknown")
        if role == "system":
            role = "system"
        return {"role": role, "content": msg.content}

# 1. POST /chat - main chat endpoint, runs LangGraph agent
@app.post("/chat", status_code=status.HTTP_200_OK)
async def chat(request: ChatRequest):
    try:
        # Input state with the user message
        initial_state = {"messages": [HumanMessage(content=request.message)]}
        
        # Configure the thread (allows state persistence)
        # Using request.thread_id or default fallback
        config = {"configurable": {"thread_id": request.thread_id or "default-thread"}}
        
        # Invoke the LangGraph agent
        response_state = graph.invoke(initial_state, config=config)
        
        messages = response_state.get("messages", [])
        if not messages:
            raise HTTPException(status_code=500, detail="Agent did not return any messages.")
            
        # Get the final AI response
        last_message = messages[-1]
        
        # Let's find the last text content from AIMessage
        ai_response_text = ""
        # Iterate backwards to find the last assistant message with content
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and msg.content:
                ai_response_text = msg.content
                break
                
        # If no message content was found (e.g. only tool calls), default to a placeholder
        if not ai_response_text:
            ai_response_text = "I have processed your request."

        return {
            "response": ai_response_text,
            "messages": [serialize_message(msg) for msg in messages]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running agent: {str(e)}")

# 2. POST /interactions - direct form submit
@app.post("/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def create_interaction(payload: InteractionCreate, db: Session = Depends(get_db)):
    # Verify HCP exists
    hcp = db.query(HCP).filter(HCP.id == payload.hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail=f"HCP with ID {payload.hcp_id} not found")
        
    interaction = Interaction(
        hcp_id=payload.hcp_id,
        interaction_type=payload.interaction_type,
        date=payload.date,
        time=payload.time,
        attendees=payload.attendees,
        topics_discussed=payload.topics_discussed,
        materials_shared=payload.materials_shared,
        samples_distributed=payload.samples_distributed,
        sentiment=payload.sentiment,
        outcomes=payload.outcomes,
        follow_up_actions=payload.follow_up_actions
    )
    db.add(interaction)
    
    # Update HCP's last met date if newer
    if payload.date:
        if not hcp.last_met or payload.date > hcp.last_met:
            hcp.last_met = payload.date
            
    db.commit()
    db.refresh(interaction)
    return interaction

# 3. GET /interactions - get all interactions
@app.get("/interactions", response_model=List[InteractionResponse], status_code=status.HTTP_200_OK)
async def get_all_interactions(db: Session = Depends(get_db)):
    # Return all interactions sorted by date descending, then time descending
    return db.query(Interaction).order_by(Interaction.date.desc(), Interaction.time.desc()).all()

# 4. GET /hcp/{name} - get HCP profile
@app.get("/hcp/{name}", response_model=HCPResponse, status_code=status.HTTP_200_OK)
async def get_hcp_profile_endpoint(name: str, db: Session = Depends(get_db)):
    # Fuzzy match on HCP name
    hcp = db.query(HCP).filter(HCP.name.ilike(f"%{name}%")).first()
    if not hcp:
        raise HTTPException(status_code=404, detail=f"HCP with name matching '{name}' not found")
    return hcp

# 5. PUT /interactions/{id} - edit interaction
@app.put("/interactions/{id}", response_model=InteractionResponse, status_code=status.HTTP_200_OK)
async def update_interaction_endpoint(id: int, payload: InteractionUpdate, db: Session = Depends(get_db)):
    interaction = db.query(Interaction).filter(Interaction.id == id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail=f"Interaction with ID {id} not found")
        
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(interaction, key, value)
        
    db.commit()
    db.refresh(interaction)
    return interaction
