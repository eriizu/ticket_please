FROM rust:1.92

WORKDIR /usr/src/myapp
COPY ./Cargo.toml ./Cargo.lock ./
COPY ./src ./src
COPY ./.sqlx ./.sqlx
COPY ./migrations ./migrations
RUN cargo install --path .

CMD ["ticket_please_be"]
