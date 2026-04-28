"""Minimal auth for the merged SPA (JWT-shaped token, optional UI password)."""

from __future__ import annotations

import base64
import json
import os
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = "admin"
    password: str = ""


def _b64url_segment(obj: dict) -> str:
    raw = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def issue_access_token() -> str:
    exp = int(time.time()) + 365 * 24 * 3600
    header = _b64url_segment({"alg": "none", "typ": "JWT"})
    payload = _b64url_segment({"exp": exp, "sub": "car-admin"})
    # Third segment satisfies 3-part JWT shape for client parsers.
    signature = _b64url_segment({})
    return f"{header}.{payload}.{signature}"


@router.post("/login")
def login(req: LoginRequest) -> dict:
    expected = os.environ.get("SWYFT_CAR_UI_PASSWORD", "").strip()
    if expected and req.password != expected:
        raise HTTPException(status_code=401, detail={"message": "Invalid password"})
    return {"access_token": issue_access_token(), "token_type": "bearer"}


@router.post("/refresh")
def refresh() -> dict:
    return {"access_token": issue_access_token(), "token_type": "bearer"}
