WITH active_list_master AS (
    SELECT
        lm_id,
        lm_name,
        MAX(lm_id) OVER (PARTITION BY lm_name) AS keep_id
    FROM list_master
    WHERE lm_deleted_at IS NULL
),
repointed AS (
    SELECT lm_id, keep_id
    FROM active_list_master
    WHERE lm_id != keep_id
)
UPDATE list_master
SET lm_parent = repointed.keep_id
FROM repointed
WHERE list_master.lm_parent = repointed.lm_id;

WITH repointed AS (
    SELECT lm_id, keep_id
    FROM (
        SELECT
            lm_id,
            lm_name,
            MAX(lm_id) OVER (PARTITION BY lm_name) AS keep_id
        FROM list_master
        WHERE lm_deleted_at IS NULL
    ) active_list_master
    WHERE lm_id != keep_id
)
UPDATE waiting_list
SET lm_id = repointed.keep_id
FROM repointed
WHERE waiting_list.lm_id = repointed.lm_id;

WITH repointed AS (
    SELECT lm_id, keep_id
    FROM (
        SELECT
            lm_id,
            lm_name,
            MAX(lm_id) OVER (PARTITION BY lm_name) AS keep_id
        FROM list_master
        WHERE lm_deleted_at IS NULL
    ) active_list_master
    WHERE lm_id != keep_id
)
DELETE FROM list_master
USING repointed
WHERE list_master.lm_id = repointed.lm_id;

CREATE UNIQUE INDEX list_master_lm_name_unique
ON list_master (lm_name)
WHERE lm_deleted_at IS NULL;
