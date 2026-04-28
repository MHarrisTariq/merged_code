"""
Swyft API gateway — public HTTP surface for pricing, listings, and admin.

Run (from repo `swyft-pricing-platform` with PYTHONPATH=.):

  uvicorn api-gateway.main:app --reload --host 0.0.0.0 --port 8000

Or from `api-gateway/`:

  set PYTHONPATH=..;..\\services\\pricing-engine;..\\services\\admin-service
  uvicorn main:app ...
"""

from __future__ import annotations

from car_rental_api import app

__all__ = ["app"]
