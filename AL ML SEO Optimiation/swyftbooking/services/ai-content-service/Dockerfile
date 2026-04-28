FROM node:20-alpine

WORKDIR /app/services/ai-content-service

COPY services/ai-content-service/package*.json ./
RUN npm install --omit=dev

COPY services/ai-content-service/ ./

WORKDIR /app
COPY packages/ ./packages/

# Ensure shared packages can resolve their runtime deps when imported from /app/packages/*
RUN npm init -y >/dev/null 2>&1 && npm install --omit=dev ioredis

WORKDIR /app/services/ai-content-service

EXPOSE 5002
CMD ["node", "index.js"]

