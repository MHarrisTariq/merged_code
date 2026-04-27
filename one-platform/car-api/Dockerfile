FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV SWYFT_INTEGRATED_CAR=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "car_rental_api:app", "--host", "0.0.0.0", "--port", "8000"]
