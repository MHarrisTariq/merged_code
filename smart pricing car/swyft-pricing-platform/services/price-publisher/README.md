# Price Publisher Service

Consumes `pricing.recommendation.generated`, upserts `price_calendar` in PostgreSQL, and caches `price:{listing_id}:{date}` in Redis.
