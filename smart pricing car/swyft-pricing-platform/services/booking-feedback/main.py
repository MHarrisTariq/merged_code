"""Booking feedback consumer service."""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from consumer import run_booking_feedback_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("booking-feedback")

_stop = threading.Event()
_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _thread
    _stop.clear()
    _thread = threading.Thread(target=run_booking_feedback_loop, args=(_stop,), daemon=True)
    _thread.start()
    logger.info("booking-feedback worker started")
    yield
    _stop.set()
    if _thread:
        _thread.join(timeout=5)


app = FastAPI(title="Swyft Booking Feedback", version="1.0.0", lifespan=lifespan)
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"ok": True, "service": "booking-feedback"}
