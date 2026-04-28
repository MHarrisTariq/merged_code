"""
Fraud / abuse heuristics: IP + user rate limits and demand-signal flags.
Attaches fraud_score for downstream Kafka demand metrics (set by producers).
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_IP_WINDOW_SEC = int(os.environ.get("FRAUD_IP_WINDOW_SEC", "60"))
_IP_MAX = int(os.environ.get("FRAUD_IP_MAX_REQUESTS", "300"))
_USER_WINDOW_SEC = int(os.environ.get("FRAUD_USER_WINDOW_SEC", "60"))
_USER_MAX = int(os.environ.get("FRAUD_USER_MAX_REQUESTS", "120"))
_VIEW_SPIKE_MULT = float(os.environ.get("FRAUD_VIEW_SPIKE_MULT", "10.0"))
_REGIONAL_AVG_VIEWS = int(os.environ.get("FRAUD_REGIONAL_AVG_VIEWS", "100"))


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


class FraudMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, regional_avg_views: int | None = None):
        super().__init__(app)
        self._ip_hits: dict[str, list[float]] = defaultdict(list)
        self._user_hits: dict[str, list[float]] = defaultdict(list)
        self._regional_avg = regional_avg_views or _REGIONAL_AVG_VIEWS

    def _prune(self, bucket: dict[str, list[float]], window: int) -> None:
        now = time.time()
        for k, ts in list(bucket.items()):
            bucket[k] = [t for t in ts if now - t < window]
            if not bucket[k]:
                del bucket[k]

    def _rate_ok(self, key: str, bucket: dict[str, list[float]], window: int, limit: int) -> bool:
        now = time.time()
        self._prune(bucket, window)
        arr = bucket[key]
        if len(arr) >= limit:
            return False
        arr.append(now)
        return True

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in ("/health", "/metrics", "/favicon.ico", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        ip = _client_ip(request)
        if not self._rate_ok(ip, self._ip_hits, _IP_WINDOW_SEC, _IP_MAX):
            return JSONResponse({"code": "rate_limited", "message": "Too many requests from IP"}, status_code=429)

        uid = request.headers.get("X-User-Id", "anon")
        if not self._rate_ok(uid, self._user_hits, _USER_WINDOW_SEC, _USER_MAX):
            return JSONResponse({"code": "rate_limited", "message": "Too many requests for user"}, status_code=429)

        response = await call_next(request)
        # Optional listing spike hint header for clients / logging
        listing_id = request.query_params.get("listingId") or request.path_params.get("listing_id")
        if listing_id and request.url.path.startswith("/pricing-signals"):
            # Synthetic views from pricing-signals could be compared to regional average (demo hook).
            views_header = request.headers.get("X-Listing-Views")
            if views_header:
                try:
                    v = int(views_header)
                    if v > _VIEW_SPIKE_MULT * self._regional_avg:
                        response.headers["X-Fraud-Flag"] = "view_spike"
                except ValueError:
                    pass
        return response


def compute_fraud_score(*, views: int | None, regional_avg: int | None = None) -> float:
    """Return 0..1 score; higher = more suspicious."""
    avg = regional_avg or _REGIONAL_AVG_VIEWS
    if views is None or avg <= 0:
        return 0.0
    if views > _VIEW_SPIKE_MULT * avg:
        return min(1.0, (views / float(avg * _VIEW_SPIKE_MULT)) * 0.5)
    return 0.0
