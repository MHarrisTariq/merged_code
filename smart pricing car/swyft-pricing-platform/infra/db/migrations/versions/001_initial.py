"""initial schema mirror

Revision ID: 001
Revises:
Create Date: 2026-04-03

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pricing_settings (
          listing_id TEXT PRIMARY KEY,
          min_price NUMERIC NOT NULL,
          max_price NUMERIC NOT NULL,
          base_price NUMERIC NOT NULL,
          pricing_goal VARCHAR(50),
          risk_tolerance VARCHAR(50),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS price_calendar (
          id SERIAL PRIMARY KEY,
          listing_id TEXT NOT NULL,
          date DATE NOT NULL,
          price NUMERIC NOT NULL,
          confidence_score FLOAT,
          model_version VARCHAR(50),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(listing_id, date)
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
          booking_id UUID PRIMARY KEY,
          listing_id TEXT NOT NULL,
          price NUMERIC NOT NULL,
          booked_at TIMESTAMP,
          status VARCHAR(50),
          guest_id UUID
        );
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS bookings;")
    op.execute("DROP TABLE IF EXISTS price_calendar;")
    op.execute("DROP TABLE IF EXISTS pricing_settings;")
