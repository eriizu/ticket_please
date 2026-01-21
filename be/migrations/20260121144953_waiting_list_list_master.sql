ALTER TABLE waiting_list
ADD COLUMN lm_id int references list_master(lm_id);
