create table list_master (
    lm_id serial primary key,
    lm_secret text not null,
    lm_name text not null,
    lm_parent int references list_master(lm_id) on delete set null,
    lm_deleted_at timestamp with time zone
);
