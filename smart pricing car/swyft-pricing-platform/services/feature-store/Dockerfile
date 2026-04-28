# syntax=docker/dockerfile:1
FROM python:3.11-slim AS builder
COPY swyft-pricing-platform/services/feature-store/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

FROM python:3.11-slim AS runtime
RUN useradd -m -u 10001 appuser
WORKDIR /app
ENV PYTHONPATH=/app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY swyft-pricing-platform /app
USER appuser
WORKDIR /app/services/feature-store
EXPOSE 8023
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8023/health', timeout=3)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8023"]
