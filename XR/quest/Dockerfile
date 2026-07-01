FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm init -y && npm install express ws 2>/dev/null || true
EXPOSE 7778
CMD ["node", "quest_backend.js"]
