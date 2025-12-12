begin;
    -- SET CONSTRAINTS ALL DEFERRED;

    create table waiting_list (
        wlist_id serial primary key,
        wlist_secret text not null,
        wlist_name text not null,
        wlist_opens_at timestamp with time zone,
        wlist_closes_at timestamp with time zone
    );

    create table waiting_token (
        wtoken_id serial primary key,
        wtoken_secret text,
        wtoken_client_name text,
        wtoken_generated_at timestamp with time zone default now(),
        wtoken_est_turn_time timestamp with time zone,
        wtoken_real_turn_time timestamp with time zone,
        wlist_id int references waiting_list(wlist_id) on delete cascade
        -- slot_id int references slot(slot_id) on delete set null
        -- slot_id int references slot(slot_id) on delete set null deferrable initially deferred
    );

    create table slot (
        slot_id serial primary key,
        slot_starts_at timestamp with time zone not null,
        slot_ends_at timestamp with time zone not null,
        wlist_id int references waiting_list(wlist_id) on delete cascade not null
    );

    alter table waiting_token
    add column slot_id int,
    add constraint fk_slot_id foreign key (slot_id) references slot(slot_id);

commit;

