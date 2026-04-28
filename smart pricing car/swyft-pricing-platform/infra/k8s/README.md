# Kubernetes manifests

`api-gateway/` and `demand-service/` are fully wired examples (Deployment + ClusterIP/LoadBalancer Service + HPA + ConfigMap + Secret placeholders).

For `pricing-engine`, `supply-service`, `feature-store`, `recommendation-service`, `booking-feedback`, `admin-service`, and `price-publisher`, duplicate the `demand-service` pattern:

- Container port: `8010` (pricing-engine), `8021`–`8026` for the others as in each service Dockerfile `EXPOSE`.
- Image: `REPLACE_ECR/<service>:tag`
- Env: reuse `swyft-config` or per-service ConfigMaps mirroring `docker-compose.yml`.
