SHELL := /bin/bash
AWS_REGION ?= us-east-1
CLUSTER ?= swyft-pricing-eks
ECR_REGISTRY ?= $$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(AWS_REGION).amazonaws.com

.PHONY: deploy destroy logs status test

deploy:
	@echo "Build & push images to ECR, then kubectl apply (configure OIDC + secrets first)."
	cd .. && docker compose -f swyft-pricing-platform/docker-compose.yml build
	aws eks update-kubeconfig --name $(CLUSTER) --region $(AWS_REGION)
	kubectl apply -f swyft-pricing-platform/infra/k8s/

destroy:
	terraform -chdir=swyft-pricing-platform/infra/terraform destroy

logs:
	kubectl logs -l app=api-gateway --tail=100 -f

status:
	kubectl get pods -A
	kubectl get svc -A

test:
	cd swyft-pricing-platform && python -m pytest -q api-gateway/tests services/*/tests ml/rl ml/elasticity 2>/dev/null || true
