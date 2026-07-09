from typing import Literal
from dotenv import load_dotenv
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import ToolNode
from langchain_groq import ChatGroq

from agent.tools import (
    get_hcp_profile,
    log_interaction,
    analyze_sentiment,
    suggest_followup,
    edit_interaction,
    create_hcp
)

import os

load_dotenv()

# Ensure some dummy key is set if not present in the environment
if not os.getenv("GROQ_API_KEY"):
    os.environ["GROQ_API_KEY"] = "dummy_key_for_import_and_compilation"

# Define the list of tools available to the agent
tools = [
    get_hcp_profile,
    log_interaction,
    analyze_sentiment,
    suggest_followup,
    edit_interaction,
    create_hcp
]

# Initialize LLM and bind tools
# Model is specified as llama-3.3-70b-versatile
llm = ChatGroq(model_name="llama-3.3-70b-versatile",temperature=0)
model_with_tools = llm.bind_tools(tools)

def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    """Determines whether to call a tool or finish the cycle."""
    messages = state["messages"]
    last_message = messages[-1]
    
    # If the model called a tool, route to the tools node
    if last_message.tool_calls:
        return "tools"
        
    # Otherwise, stop and return to the user
    return END

def call_model(state: MessagesState):
    """Invokes the model with system prompts and message history."""
    messages = state["messages"]
    
    system_prompt = {
        "role": "system",
        "content": (
            "You are RepSync AI, assistant for pharma sales reps.\n"
            "Today's date: Thursday, July 09, 2026.\n\n"
            "TOOLS:\n"
            "1. get_hcp_profile(name): Get doctor profile and history\n"
            "2. log_interaction(data): Log meeting notes and save to DB\n"
            "3. analyze_sentiment(text): Analyze sentiment of text\n"
            "4. suggest_followup(topics, sentiment, hcp_profile): Suggest next steps\n"
            "5. edit_interaction(interaction_id, field, new_value): Edit saved interaction. Use 'latest' for most recent.\n"
            "6. create_hcp(name, hospital, specialization, notes): Create new doctor profile\n\n"
            "STRICT RULES:\n"
            "1. When user shares meeting notes:\n"
            "   → FIRST call get_hcp_profile to check if doctor exists\n"
            "   → If NOT found: call create_hcp with name, hospital, specialization from notes\n"
            "   → Then call log_interaction\n"
            "   → NEVER let log_interaction auto-create doctors!\n\n"
            "2. When user says change/update/edit anything:\n"
            "   → call edit_interaction with interaction_id='latest' if no ID given\n"
            "   → NEVER ask user for interaction ID\n\n"
            "3. When user asks to update doctor details:\n"
            "   → call edit_hcp_profile tool\n\n"
            "4. Always call ONE tool at a time\n"
            "5. Resolve relative dates using July 09, 2026\n"
        )
    }
    
    # Build list of messages to pass to the model
    response = model_with_tools.invoke([system_prompt] + messages)
    return {"messages": [response]}

# Set up the StateGraph
workflow = StateGraph(MessagesState)

# Add the nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode(tools))

# Connect nodes
workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

# Compile graph
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)
