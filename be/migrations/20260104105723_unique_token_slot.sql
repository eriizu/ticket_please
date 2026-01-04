-- Add migration script here
alter table waiting_token
add constraint unique_slot_id unique(slot_id);
