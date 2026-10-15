FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3333
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
