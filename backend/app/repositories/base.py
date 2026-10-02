from abc import ABC, abstractmethod
from typing import Generic, List, Optional, TypeVar

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    """Generic repository base contract."""

    @abstractmethod
    async def get_by_id(self, item_id: str) -> Optional[T]:
        pass

    @abstractmethod
    async def create(self, item: T) -> T:
        pass

    @abstractmethod
    async def update(self, item_id: str, updates: dict) -> Optional[T]:
        pass

    @abstractmethod
    async def delete(self, item_id: str) -> bool:
        pass
