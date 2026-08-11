# Reverse proxy AMIS Kho phim cho Cloud Run — chỉ dùng để test, KHÔNG phải hạ tầng chính
# thức (xem docs/devops-handoff.md). Bản cục bộ dùng nginx.conf gắn qua volume; Cloud Run
# không cho mount volume ngoài image nên nướng thẳng file conf vào image tại build time
# (hostname 2 service kia đã cố định, không cần envsubst runtime).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
