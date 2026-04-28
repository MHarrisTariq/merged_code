"""SQLAlchemy ORM models (aligned with infra/db/postgres_schema.sql)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import uuid


class Base(DeclarativeBase):
    pass


class PricingSetting(Base):
    __tablename__ = "pricing_settings"

    listing_id: Mapped[str] = mapped_column(Text, primary_key=True)
    min_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    max_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    pricing_goal: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_tolerance: Mapped[str | None] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default="NOW()")


class PriceCalendar(Base):
    __tablename__ = "price_calendar"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    listing_id: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, server_default="NOW()")


class BookingRow(Base):
    __tablename__ = "bookings"

    booking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    listing_id: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guest_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
