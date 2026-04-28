FROM node:20-alpine

WORKDIR /app

COPY services/prediction-service/package*.json ./
RUN npm install --omit=dev

COPY services/prediction-service/ ./

EXPOSE 5004
CMD ["node", "index.js"]

