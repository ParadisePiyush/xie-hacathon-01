from typing import Any, Dict, List
from fastapi import WebSocket
from app.core.logging import logger


class ConnectionManager:
    """Manages active WebSocket connections for real-time telemetry and event broadcast."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Total active: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket client disconnected. Total active: %d", len(self.active_connections))

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcast JSON message event to all active clients."""
        payload = {"event": event_type, "data": data}
        stale_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(payload)
            except Exception as err:
                logger.warning("Error broadcasting to websocket connection: %s", err)
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(stale)


ws_manager = ConnectionManager()
