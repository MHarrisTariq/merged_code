# Kubernetes (sample)

Minimal pattern for the pricing API: Deployment + Service. Tune replicas, resources, and secrets for your cluster.

## Apply

```bash
kubectl apply -f deployment.yaml
```

## Secrets (example)

Store `API_KEY`, `REDIS_URL`, or model registry credentials in a Secret and mount/env-reference them — do not commit real values.

## HPA (recommended)

Add a HorizontalPodAutoscaler on CPU **or** custom metric `http_request_duration_seconds` p99 (requires Prometheus adapter).

See **docs/FULL_ENGINEERING_SPEC.md §4** for autoscaling guidance.
