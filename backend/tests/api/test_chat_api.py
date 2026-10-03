import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_chat_suggestions(async_client: AsyncClient):
    response = await async_client.get("/api/v1/chat/suggestions")
    assert response.status_code == 200
    suggestions = response.json()
    assert isinstance(suggestions, list)
    assert len(suggestions) > 0


@pytest.mark.asyncio
async def test_chat_message(async_client: AsyncClient):
    payload = {
        "message": "How does waste priority scoring work?",
        "history": [],
    }
    response = await async_client.post("/api/v1/chat/message", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "suggestions" in data
    assert "model" in data
