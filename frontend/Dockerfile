# syntax=docker/dockerfile:1
# الواجهة (Next.js standalone). السياق: مجلد frontend
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# متغيرات NEXT_PUBLIC_* تُدمج وقت البناء. الافتراضي /api يعمل حين يخدم Dokploy الـ API على المسار /api من نفس العنوان
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_COMPANY_NAME=
ARG NEXT_PUBLIC_COMPANY_VAT=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_PUBLIC_COMPANY_VAT=$NEXT_PUBLIC_COMPANY_VAT \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
