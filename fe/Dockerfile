FROM oven/bun:1 AS base
WORKDIR /usr/src/app
RUN mkdir -p /temp/dev
COPY package.json bun.lock .
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM alpinelinux/darkhttpd
COPY --from=base /usr/src/app/dist /var/www/localhost/htdocs

