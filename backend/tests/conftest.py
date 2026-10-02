import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.repositories.in_memory_request_repository import in_memory_repository
from app.services.priority_service import PriorityService


@pytest.fixture(autouse=True)
def reset_repository():
    """Reset repository in-memory state before every test."""
    in_memory_repository._requests.clear()
    in_memory_repository._histories.clear()
    yield
    in_memory_repository._requests.clear()
    in_memory_repository._histories.clear()


@pytest.fixture
def priority_engine():
    return PriorityService()


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
