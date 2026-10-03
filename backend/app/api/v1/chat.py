from typing import List, Optional
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.services.chat_service import chat_service

router = APIRouter(prefix="/chat", tags=["AI Assistant (Gemini)"])


class ChatMessageItem(BaseModel):
    role: str = Field(..., pattern="^(user|model|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: Optional[List[ChatMessageItem]] = None


class ChatResponse(BaseModel):
    reply: str
    suggestions: List[str]
    model: str


@router.post(
    "/message",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with Gemini Municipal Assistant",
    description="Interactive AI assistant for citizens, dispatchers, and collectors with platform context.",
)
async def send_chat_message(payload: ChatRequest):
    history_dicts = None
    if payload.history:
        history_dicts = [{"role": h.role, "content": h.content} for h in payload.history]

    result = await chat_service.get_chat_response(
        user_message=payload.message,
        history=history_dicts,
    )
    return ChatResponse(
        reply=result["reply"],
        suggestions=result.get("suggestions", []),
        model=result.get("model", "gemini-3.8-flash"),
    )


@router.get(
    "/suggestions",
    response_model=List[str],
    summary="Get initial conversation prompt suggestions",
)
async def get_initial_suggestions():
    return [
        "How is priority score calculated?",
        "What qualifies as hazardous waste?",
        "How does route optimization work?",
        "What are the SLA resolution times?",
    ]
