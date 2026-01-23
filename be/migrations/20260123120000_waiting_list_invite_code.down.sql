DROP INDEX IF EXISTS waiting_list_wlist_invite_code_unique;
ALTER TABLE waiting_list
DROP COLUMN IF EXISTS wlist_invite_code;
