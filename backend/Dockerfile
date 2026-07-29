# syntax=docker/dockerfile:1
# ── build ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
# npm ci (không npm install) + copy cả package-lock.json: cài đúng phiên bản đã khoá,
# build tái lập được, tránh vô tình kéo phiên bản mới bị chèn mã độc.
# --ignore-scripts: chặn script postinstall độc hại. Chuẩn Backend MISA — 02 §5/§6.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── runtime ────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
