from collections import defaultdict
from datetime import datetime, timezone
import time
from typing import Dict, List
from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Sliding-window rate limiter for protecting endpoints against brute force and abuse."""

    def __init__(self):
        # key -> list of float epoch timestamps
        self._records: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int = 60) -> None:
        now = time.time()
        cutoff = now - window_seconds

        # Prune old timestamps
        timestamps = [t for t in self._records[key] if t > cutoff]

        if len(timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - timestamps[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds}s. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        self._records[key] = timestamps

    def reset(self):
        self._records.clear()


rate_limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For if behind a reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"
