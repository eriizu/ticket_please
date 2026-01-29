FROM oven/bun:1 AS build
WORKDIR /usr/src/app
RUN mkdir -p /temp/dev
COPY package.json bun.lock .
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# FROM alpinelinux/darkhttpd
# COPY --from=build /usr/src/app/dist /var/www/localhost/htdocs

FROM nginx:1.28-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
