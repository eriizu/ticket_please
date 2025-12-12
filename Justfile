wipe_db:
    ./db_drop.sh --db ticket_please --action wipe-db --force

mig: wipe_db
    ./psql.sh < mig.sql
