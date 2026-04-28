# Booking Feedback Service

Consumes `booking.completed`, inserts into PostgreSQL `bookings`, and can trigger an Airflow retrain DAG when thresholds are met.
