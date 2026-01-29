# Deployment

## Build

The docker image can be build with:

```sh
docker build -t ticket_be .
```

## Env

```ini
PGHOST=localhost
PGPORT=5432
PGUSER=ticket_user
PGDB=ticket_db
PGPASS=your_password
# OR
DATABASE_URL="postgres://ticket_user:your_password@localhost/ticket_db"

RUST_LOG=sqlx=warn,ticket_please_be=info,poem=warn
# on first run, do not set the variable, the secret will be generated and written in an info log
DEFAULT_LIST_MASTER=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```
