ALTER TABLE waiting_list
ADD COLUMN wlist_invite_code text;

CREATE UNIQUE INDEX waiting_list_wlist_invite_code_unique
ON waiting_list (wlist_invite_code);
