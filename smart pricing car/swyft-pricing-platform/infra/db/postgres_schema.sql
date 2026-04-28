-- Swyft pricing platform — PostgreSQL DDL (listing_id as TEXT for lst_* compatibility)

CREATE TABLE IF NOT EXISTS pricing_settings (
  listing_id TEXT PRIMARY KEY,
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  base_price NUMERIC NOT NULL,
  pricing_goal VARCHAR(50),
  risk_tolerance VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS bookings (
  booking_id UUID PRIMARY KEY,
  listing_id TEXT NOT NULL,
  price NUMERIC NOT NULL,
  booked_at TIMESTAMP,
  status VARCHAR(50),
  guest_id UUID
);

CREATE INDEX IF NOT EXISTS idx_price_calendar_listing ON price_calendar (listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings (listing_id);
