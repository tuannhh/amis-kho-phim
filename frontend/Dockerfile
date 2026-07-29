# syntax=docker/dockerfile:1
# ── build ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
# npm ci + lock file: build tái lập được, chống supply-chain (chuẩn MISA — 02 §5/§6).
# LƯU Ý: KHÔNG dùng --ignore-scripts ở đây — devDependency `sharp` (script sinh icon PWA)
# cần postinstall để tải binary nền tảng; bỏ script sẽ làm gãy bước build.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── serve tĩnh (nginx) ─────────────────────────────────
FROM nginx:1.27-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
