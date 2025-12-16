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

    pub async fn get_slot_by_list_id(&self, list_id: i32) -> Result<Vec<Slot>, RepoError> {
        let slots = sqlx::query_as(
            "select slot_id, slot_starts_at, slot_ends_at, wlist_id from slot where wlist_id = $1",
        )
        .bind(list_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_slot_by_list_id",
        })?;
        Ok(slots)
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

    pub async fn edit_slot(&self, slot_id: i32, updates: PartialSlot) -> Result<Slot, RepoError> {
        let rq_head = "UPDATE slot SET\n";
        let rq_tail = r#"RETURNING
    slot_id,
    slot_starts_at,
    slot_ends_at,
    wlist_id"#;
        todo!("this isn't the code to edit a slot, it needs to be written");
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_if_some("wlist_name", updates.slot_starts_at)?;
        generator.add_if_some("wlist_opens_at", updates.slot_ends_at)?;
        generator.add_if_some("wlist_closes_at", updates.wlist_id)?;
        generator.add_where("slot_id", slot_id)?;
        if generator.bind_idx <= 2 {
            return Err(RepoError::EmptyUpdates {
                context: "edit_waiting_list",
            });
        }
        let rq = format!("{rq_head}\n{}\n{rq_tail}", generator.build_rq_str());
        debug!("edit request built: {}", rq);
        let query = sqlx::query_as_with(&rq, generator.args);
        Ok(query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_slot",
            })?)
    }
}
