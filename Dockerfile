# syntax=docker/dockerfile:1
# تطبيق واحد: الواجهة (Next.js) + الـ API (NestJS) في صورة واحدة ومنفذ واحد (PORT، الافتراضي 3000).
# السياق: جذر المستودع.

# ---- بناء الـ API
FROM node:22-slim AS backend-build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json backend/nest-cli.json ./
COPY backend/src ./src
RUN npm run build

# ---- بناء الواجهة (standalone)
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
# الواجهة والـ API على نفس العنوان، فالمسار النسبي /api هو الصحيح دائماً
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_COMPANY_NAME=
ARG NEXT_PUBLIC_COMPANY_VAT=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_PUBLIC_COMPANY_VAT=$NEXT_PUBLIC_COMPANY_VAT \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- الصورة النهائية
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
COPY backend/scripts ./backend/scripts
COPY --from=frontend-build /app/frontend/.next/standalone ./frontend
COPY --from=frontend-build /app/frontend/.next/static ./frontend/.next/static
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
CMD ["/entrypoint.sh"]
