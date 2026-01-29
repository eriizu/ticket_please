FROM rust:1.92 as builder

WORKDIR /usr/src/myapp
COPY ./Cargo.toml ./Cargo.lock ./
COPY ./src ./src
COPY ./.sqlx ./.sqlx
COPY ./migrations ./migrations
RUN cargo install --path .

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y libc6 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/cargo/bin/ticket_please_be /usr/local/bin/ticket_please_be

EXPOSE 3000

CMD ["ticket_please_be"]
