from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from app.core.logging import logger
from app.core.websocket_manager import ws_manager


class NotificationService:
    """Handles operational notifications (email, SMS, Webhook simulation) and broadcasts critical alerts."""

    def __init__(self):
        self._sent_notifications: List[Dict[str, Any]] = []

    async def notify_status_change(
        self,
        request_id: str,
        from_status: str,
        to_status: str,
        reporter_email: Optional[str] = None,
        address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send notification when a pickup request status transitions."""
        notification = {
            "id": str(uuid.uuid4()),
            "channel": "email" if reporter_email else "in_app",
            "recipient": reporter_email or "system_dispatcher",
            "title": f"Waste Pickup Status Updated: {to_status.upper()}",
            "message": f"Pickup request {request_id[:8]} at '{address or 'Location'}' transitioned from {from_status} to {to_status}.",
            "request_id": request_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._sent_notifications.insert(0, notification)
        logger.info("Notification dispatched: %s", notification["title"])

        # Broadcast via WebSockets
        await ws_manager.broadcast("NOTIFICATION_SENT", notification)
        return notification

    async def notify_critical_hazard(
        self,
        request_id: str,
        waste_type: str,
        address: str,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """Broadcast urgent alert when a Critical/Hazardous request is submitted."""
        alert = {
            "id": str(uuid.uuid4()),
            "type": "CRITICAL_HAZARD_ALERT",
            "title": f"⚠️ URGENT: Critical {waste_type.upper()} Detected!",
            "message": f"Immediate response required at {address}. Dynamic route re-optimization recommended.",
            "request_id": request_id,
            "coords": {"lat": latitude, "lng": longitude},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._sent_notifications.insert(0, alert)
        logger.warning("CRITICAL ALERT DISPATCHED: %s", alert["title"])

        # Real-time WebSocket broadcast
        await ws_manager.broadcast("CRITICAL_ALERT", alert)
        return alert

    def get_recent_notifications(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self._sent_notifications[:limit]


notification_service = NotificationService()
