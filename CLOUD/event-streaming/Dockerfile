FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm init -y && npm install express 2>/dev/null || true
EXPOSE 8084
CMD ["node", "server.js"]
