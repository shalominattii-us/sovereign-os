FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p data

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=8s --start-period=30s --retries=10 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "index.js"]
