# syntax=docker/dockerfile:1
# API (NestJS + Prisma/MySQL). السياق: مجلد backend
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
EXPOSE 4000
# الترحيلات تُطبَّق عند كل إقلاع (آمنة: تتخطى ما طُبّق سابقاً) ثم يعمل الخادم
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
