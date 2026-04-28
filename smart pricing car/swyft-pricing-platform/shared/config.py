"""Centralized configuration from environment variables (no secrets in code)."""

from __future__ import annotations

import os
from functools import lru_cache


@lru_cache
def kafka_bootstrap_servers() -> str:
    return os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092").strip()


@lru_cache
def kafka_topic_prefix() -> str:
    return os.environ.get("KAFKA_TOPIC_PREFIX", "").strip()


@lru_cache
def redis_url() -> str:
    return os.environ.get("REDIS_URL", "redis://localhost:6379/0").strip()


@lru_cache
def postgres_dsn() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg2://swyft:swyft@localhost:5432/swyft",
    ).strip()


@lru_cache
def mongo_uri() -> str:
    return os.environ.get("MONGO_URI", "mongodb://localhost:27017").strip()


@lru_cache
def mongo_db_name() -> str:
    return os.environ.get("MONGO_DB", "swyft_pricing").strip()
