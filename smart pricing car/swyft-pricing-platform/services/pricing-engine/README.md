# Pricing Engine Service

Hosts `car_rental_service` inference artifacts and a Kafka `stream_processor` that consumes `pricing.compute.requested` and emits `pricing.recommendation.generated` using the stream formula + clamps.
