use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::debug;

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct Slot {
    pub slot_id: i32,
    pub slot_starts_at: DateTime<FixedOffset>,
    pub slot_ends_at: DateTime<FixedOffset>,
    pub wlist_id: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct PartialSlot {
    pub slot_starts_at: Option<DateTime<FixedOffset>>,
    pub slot_ends_at: Option<DateTime<FixedOffset>>,
    pub wlist_id: Option<i32>,
}

impl Repository {
    pub async fn get_slot_by_id(&self, id: i32) -> Result<Slot, RepoError> {
        let slot = sqlx::query_as(
            "select slot_id, slot_starts_at, slot_ends_at, wlist_id from slot where slot_id = $1",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_slot_by_id",
        })?;
        Ok(slot)
    }

    pub async fn create_slot(
        &self,
        starts_at: DateTime<FixedOffset>,
        ends_at: DateTime<FixedOffset>,
        list_id: i32,
    ) -> Result<Slot, RepoError> {
        let slot = sqlx::query_as(
            r#"
INSERT INTO slot(slot_starts_at, slot_ends_at, wlist_id)
VALUES ($1, $2, $3)
RETURNING
    slot_id,
    slot_starts_at,
    slot_ends_at,
    wlist_id"#,
        )
        .bind(starts_at)
        .bind(ends_at)
        .bind(list_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "create_waiting_list",
        })?;
        Ok(slot)
    }

    pub async fn edit_slot(
        &self,
        admin_token: &str,
        updates: PartialSlot,
    ) -> Result<Slot, RepoError> {
        let rq_head = "UPDATE slot SET\n";
        let rq_tail = r#"
WHERE slot_id = $1
RETURNING
    slot_id,
    slot_starts_at,
    slot_ends_at,
    wlist_id"#;
        let mut rq = rq_head.to_owned();
        let start_bind_idx = 2;
        let mut bind_idx = start_bind_idx;
        if updates.slot_starts_at.is_some() {
            rq.push_str(&format!(
                "{}slot_starts_at = ${}",
                if bind_idx != 2 { ",\n" } else { "" },
                bind_idx
            ));
            bind_idx += 1;
        }
        if updates.slot_ends_at.is_some() {
            rq.push_str(&format!(
                "{}slot_ends_at = ${}",
                if bind_idx != 2 { ",\n" } else { "" },
                bind_idx
            ));
            bind_idx += 1;
        }
        if updates.wlist_id.is_some() {
            rq.push_str(&format!(
                "{}wlist_id = ${}",
                if bind_idx != 2 { ",\n" } else { "" },
                bind_idx
            ));
        }
        if start_bind_idx == bind_idx {
            return Err(RepoError::EmptyUpdates {
                context: "edit_slot",
            });
        }
        rq.push_str(rq_tail);
        debug!("edit request built: {}", rq);
        let mut query = sqlx::query_as(&rq).bind(admin_token);
        if let Some(value) = updates.slot_starts_at {
            query = query.bind(value)
        }
        if let Some(value) = updates.slot_ends_at {
            query = query.bind(value)
        }
        if let Some(value) = updates.wlist_id {
            query = query.bind(value)
        }
        Ok(query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_slot",
            })?)
    }
}
