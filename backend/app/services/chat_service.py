import json
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error

from app.core.config import settings
from app.core.logging import logger
from app.repositories.in_memory_request_repository import in_memory_repository
from app.repositories.resource_repository import resource_repository
from app.services.priority_service import priority_service


class ChatService:
    """Service interfacing with Google Gemini AI to provide smart municipal waste advice."""

    PRIMARY_MODELS = [
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest",
    ]

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.active_model = "gemini-3.1-flash-lite"

    async def _build_system_context(self) -> str:
        """Assembles real-time platform statistics to inject into the LLM system prompt."""
        try:
            reqs = await in_memory_repository.list_all()
            total = len(reqs)
            critical = sum(1 for r in reqs if r.priority_band.value == "critical")
            high = sum(1 for r in reqs if r.priority_band.value == "high")
            medium = sum(1 for r in reqs if r.priority_band.value == "medium")
            low = sum(1 for r in reqs if r.priority_band.value == "low")

            depots = await resource_repository.list_depots()
            zones = await resource_repository.list_zones()

            cfg = priority_service.config
            w = cfg.weights
            formula = (
                f"Score = 100 * ({w.w_hazard}*hazard + {w.w_age}*age + "
                f"{w.w_volume}*volume + {w.w_repeat}*repeat + {w.w_sla_risk}*sla_risk)"
            )

            context = (
                f"You are EcoBot, the intelligent AI municipal assistant for the Smart Waste Collection Optimizer platform.\n"
                f"Current Operational Status:\n"
                f"- Total Requests: {total}\n"
                f"- Priority Breakdown: {critical} Critical (>=75), {high} High (50-74), {medium} Medium (25-49), {low} Low (<25)\n"
                f"- Depots: {', '.join([d.name for d in depots]) if depots else 'Central Operations Depot'}\n"
                f"- Zones: {', '.join([z.name for z in zones]) if zones else 'Downtown, North Residential, East Industrial'}\n"
                f"- Prioritization Formula: {formula}\n"
                f"- Waste Types: organic, recyclable, hazardous, e_waste, medical, construction, general.\n"
                f"- Volumes: small (1-2 bags / 1 unit), medium (half truck / 3 units), large (full truck / 8 units), overflow (public hazard / 15 units).\n"
                f"Guidelines:\n"
                f"1. Give concise, actionable, friendly municipal and operational advice.\n"
                f"2. For hazardous or medical waste, emphasize public safety, non-touching precautions, and urgent dispatching.\n"
                f"3. Explain priority scores clearly using the mathematical weights when asked.\n"
                f"4. Format your output using clean markdown with short paragraphs and bullet points."
            )
            return context
        except Exception as e:
            logger.warning("Error assembling system context for EcoBot: %s", e)
            return "You are EcoBot, the municipal assistant for Smart Waste Collection Optimizer."

    async def get_chat_response(
        self,
        user_message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Sends conversation history and current query to Gemini AI with fallback cascade."""
        system_context = await self._build_system_context()

        # Build contents array compatible with Google Generative Language API
        contents = []

        if history:
            for item in history[-8:]:  # Keep recent context
                role = "user" if item.get("role") in ("user", "citizen", "dispatcher") else "model"
                content = item.get("content", "")
                if content:
                    contents.append({
                        "role": role,
                        "parts": [{"text": content}]
                    })

        # Append latest user message
        contents.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })

        payload = {
            "system_instruction": {
                "parts": [{"text": system_context}]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.5,
                "maxOutputTokens": 800,
            }
        }

        # If no Gemini API key configured, gracefully use local municipal assistant logic
        if not self.api_key:
            return self._fallback_response(user_message)

        req_data = json.dumps(payload).encode("utf-8")

        # Try models in cascade order
        for model_name in self.PRIMARY_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers={
                        "Content-Type": "application/json",
                        "x-goog-api-key": self.api_key,
                    },
                    method="POST",
                )

                with urllib.request.urlopen(req, timeout=10) as response:
                    res_body = json.loads(response.read().decode("utf-8"))

                candidates = res_body.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        reply_text = parts[0]["text"]
                        self.active_model = model_name
                        suggestions = self._derive_suggestions(user_message, reply_text)
                        return {
                            "reply": reply_text,
                            "suggestions": suggestions,
                            "model": model_name,
                        }
            except urllib.error.HTTPError as e:
                err_text = ""
                try:
                    err_text = e.read().decode("utf-8")
                except Exception:
                    pass
                logger.warning("Gemini model %s HTTP %s: %s", model_name, e.code, err_text)
                continue
            except Exception as e:
                logger.warning("Gemini model %s error: %s", model_name, e)
                continue

        # If all API calls fail, gracefully return intelligent municipal fallback
        return self._fallback_response(user_message)

    def _derive_suggestions(self, query: str, reply: str) -> List[str]:
        """Provides relevant one-click suggestion chips based on the conversation topic."""
        q_lower = query.lower()
        if "hazard" in q_lower or "toxic" in q_lower or "chemical" in q_lower:
            return ["Report Hazardous Spill", "View Critical Alerts", "Containment Procedures"]
        elif "score" in q_lower or "priority" in q_lower or "formula" in q_lower:
            return ["View SLA Rules", "How is Volume Calculated?", "Check Critical Threshold"]
        elif "route" in q_lower or "optimize" in q_lower or "dispatch" in q_lower:
            return ["Launch VRP Planning", "Check Vehicle Capacity", "Collector Route View"]
        else:
            return ["How to report waste?", "What is SLA compliance?", "Explain Priority Formula"]

    def _fallback_response(self, user_message: str) -> Dict[str, Any]:
        """Graceful fallback in case of rate limits or network issues."""
        q = user_message.lower()
        if "score" in q or "priority" in q:
            reply = (
                "**Smart Priority Formula**:\n\n"
                "`Score = 100 × (0.35·Hazard + 0.25·Age + 0.15·Volume + 0.10·Repeat + 0.15·SLA_Risk)`\n\n"
                "- 🔴 **Critical**: Score ≥ 75 (Immediate dispatch)\n"
                "- 🟠 **High**: Score 50–74\n"
                "- 🟡 **Medium**: Score 25–49\n"
                "- 🟢 **Low**: Score < 25"
            )
        elif "hazard" in q or "safety" in q:
            reply = (
                "⚠️ **Hazardous & Medical Waste Safety Protocol**:\n\n"
                "1. **Do not handle** direct chemicals, broken batteries, or syringes.\n"
                "2. Keep a safe perimeter (min 5 meters) from foot traffic.\n"
                "3. Drop a pin marker immediately and set waste type to **Hazardous**.\n"
                "4. Our system automatically triggers a **Critical Alert** for rapid dispatch."
            )
        else:
            reply = (
                "Hello! I am **EcoBot**, your Smart Waste Collection municipal assistant. "
                "You can ask me how to classify waste, how priority scores are computed, "
                "or how the OR-Tools route optimizer schedules pickups."
            )

        return {
            "reply": reply,
            "suggestions": ["Explain Priority Formula", "Hazardous Waste Safety", "Route Optimization Rules"],
            "model": "ecobot-local-fallback",
        }


chat_service = ChatService()
