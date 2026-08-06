FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm init -y && npm install express 2>/dev/null || true
EXPOSE 8082
ENV WALLET_V1_PORT=8082
CMD ["node", "TREASURY/wallet-v1/server.js"]
