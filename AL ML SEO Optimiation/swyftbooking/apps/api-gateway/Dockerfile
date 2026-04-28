FROM node:20-alpine

WORKDIR /app

COPY apps/api-gateway/package*.json ./
RUN npm install --omit=dev

COPY apps/api-gateway/ ./

EXPOSE 5000
CMD ["node", "index.js"]

