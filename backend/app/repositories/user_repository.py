from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import uuid

from app.core.security import get_password_hash
from app.schemas.user import AuditLogResponse, UserCreate, UserResponse, UserRole, UserUpdate


class UserRepository:
    """In-memory User and AuditLog repository with SQLite/Postgres compatibility."""

    def __init__(self):
        self._users: Dict[str, Dict[str, Any]] = {}
        self._audit_logs: List[Dict[str, Any]] = []
        self._seed_default_users()

    def _seed_default_users(self):
        """Seed default role personas for easy evaluation and automated tests."""
        defaults = [
            {
                "id": "user-admin-001",
                "email": "admin@smartwaste.city",
                "password": "Admin@123",
                "full_name": "System Administrator",
                "role": UserRole.ADMIN.value,
                "team_id": None,
                "is_active": True,
            },
            {
                "id": "user-dispatch-001",
                "email": "dispatcher@smartwaste.city",
                "password": "Dispatch@123",
                "full_name": "Lead Dispatcher",
                "role": UserRole.DISPATCHER.value,
                "team_id": None,
                "is_active": True,
            },
            {
                "id": "user-collector-001",
                "email": "collector@smartwaste.city",
                "password": "Collector@123",
                "full_name": "Field Collector 01",
                "role": UserRole.COLLECTOR.value,
                "team_id": "team-alpha",
                "is_active": True,
            },
            {
                "id": "user-citizen-001",
                "email": "citizen@smartwaste.city",
                "password": "Citizen@123",
                "full_name": "Citizen Reporter",
                "role": UserRole.REPORTER.value,
                "team_id": None,
                "is_active": True,
            },
        ]

        for u in defaults:
            self._users[u["id"]] = {
                "id": u["id"],
                "email": u["email"].lower(),
                "password_hash": get_password_hash(u["password"]),
                "full_name": u["full_name"],
                "role": u["role"],
                "team_id": u["team_id"],
                "is_active": u["is_active"],
                "created_at": datetime.now(timezone.utc),
            }

    async def get_by_id(self, user_id: str) -> Optional[UserResponse]:
        raw = self._users.get(user_id)
        if not raw:
            return None
        return UserResponse(**raw)

    async def get_by_email(self, email: str) -> Optional[Tuple[UserResponse, str]]:
        email_clean = email.strip().lower()
        for raw in self._users.values():
            if raw["email"] == email_clean:
                return UserResponse(**raw), raw["password_hash"]
        return None

    async def create_user(self, payload: UserCreate) -> UserResponse:
        user_id = str(uuid.uuid4())
        record = {
            "id": user_id,
            "email": payload.email.strip().lower(),
            "password_hash": get_password_hash(payload.password),
            "full_name": payload.full_name.strip(),
            "role": payload.role.value if isinstance(payload.role, UserRole) else str(payload.role),
            "team_id": payload.team_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        }
        self._users[user_id] = record
        return UserResponse(**record)

    async def list_users(
        self, role: Optional[str] = None, team_id: Optional[str] = None
    ) -> List[UserResponse]:
        results = []
        for raw in self._users.values():
            if role and raw["role"] != role:
                continue
            if team_id and raw["team_id"] != team_id:
                continue
            results.append(UserResponse(**raw))
        results.sort(key=lambda u: u.created_at, reverse=True)
        return results

    async def update_user(self, user_id: str, payload: UserUpdate) -> Optional[UserResponse]:
        raw = self._users.get(user_id)
        if not raw:
            return None

        if payload.email:
            raw["email"] = payload.email.strip().lower()
        if payload.full_name:
            raw["full_name"] = payload.full_name.strip()
        if payload.role:
            raw["role"] = payload.role.value if isinstance(payload.role, UserRole) else str(payload.role)
        if payload.team_id is not None:
            raw["team_id"] = payload.team_id
        if payload.is_active is not None:
            raw["is_active"] = payload.is_active
        if payload.password:
            raw["password_hash"] = get_password_hash(payload.password)

        return UserResponse(**raw)

    async def delete_user(self, user_id: str) -> bool:
        if user_id in self._users:
            # Soft delete by marking inactive
            self._users[user_id]["is_active"] = False
            return True
        return False

    async def log_audit(
        self,
        user_id: Optional[str],
        action: str,
        entity: str,
        entity_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> AuditLogResponse:
        log_id = str(uuid.uuid4())
        record = {
            "id": log_id,
            "user_id": user_id,
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "payload": payload,
            "created_at": datetime.now(timezone.utc),
        }
        self._audit_logs.insert(0, record)
        return AuditLogResponse(**record)

    async def list_audit_logs(self, limit: int = 100) -> List[AuditLogResponse]:
        return [AuditLogResponse(**log) for log in self._audit_logs[:limit]]


user_repository = UserRepository()
