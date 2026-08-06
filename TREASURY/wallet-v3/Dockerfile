FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm init -y && npm install express axios 2>/dev/null || true
EXPOSE 8084
ENV WALLET_V3_PORT=8084
CMD ["node", "TREASURY/wallet-v3/server.js"]
