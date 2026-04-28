FROM node:20-alpine

WORKDIR /app/services/analytics-service

COPY services/analytics-service/package*.json ./
RUN npm install --omit=dev

COPY services/analytics-service/ ./

WORKDIR /app
COPY packages/ ./packages/

# Ensure shared packages can resolve their runtime deps when imported from /app/packages/*
RUN npm init -y >/dev/null 2>&1 && npm install --omit=dev mongoose

WORKDIR /app/services/analytics-service

EXPOSE 5005
CMD ["node", "index.js"]

