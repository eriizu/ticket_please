use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::{debug, instrument};

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct Slot {
    pub slot_id: i32,
    pub slot_starts_at: DateTime<FixedOffset>,
    pub slot_ends_at: DateTime<FixedOffset>,
    pub wlist_id: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct SlotWithTokenId {
    pub slot_id: i32,
    pub slot_starts_at: DateTime<FixedOffset>,
    pub slot_ends_at: DateTime<FixedOffset>,
    pub wlist_id: i32,
    pub wtoken_id: Option<i32>,
}

impl std::convert::Into<Slot> for SlotWithTokenId {
    fn into(self) -> Slot {
        Slot {
            slot_id: self.slot_id,
            slot_starts_at: self.slot_starts_at,
            slot_ends_at: self.slot_ends_at,
            wlist_id: self.wlist_id,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct PartialSlot {
    pub slot_starts_at: Option<DateTime<FixedOffset>>,
    pub slot_ends_at: Option<DateTime<FixedOffset>>,
    pub wlist_id: Option<i32>,
}

impl Repository {
    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_slot_by_id(&self, id: i32) -> Result<Slot, RepoError> {
        let slot = sqlx::query_as(
            r#"select slot_id, slot_starts_at, slot_ends_at, wlist_id
from slot
where slot_id = $1"#,
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

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_slot_by_id_with_wtoken_id(
        &self,
        id: i32,
    ) -> Result<SlotWithTokenId, RepoError> {
        let slot = sqlx::query_as(
            r#"
select slot_id, slot_starts_at, slot_ends_at, slot.wlist_id, wtoken_id
from slot
left join waiting_token using(slot_id)
where slot_id = $1"#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_slot_by_id_with_token_id",
        })?;
        Ok(slot)
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn delete_slot_by_id_and_secret(
        &self,
        id: i32,
        secret: String,
    ) -> Result<(), RepoError> {
        let db_response = sqlx::query!(
            r#"DELETE FROM slot s
USING waiting_list wl
WHERE s.wlist_id = wl.wlist_id
  AND s.slot_id = $1              -- slot id
  AND wl.wlist_secret = $2        -- list secret;"#,
            id,
            secret
        )
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "delete_slot_by_id_and_secret",
        })?;
        if db_response.rows_affected() == 0 {
            Err(RepoError::NotFound {
                context: "delete_slot_by_id_and_secret",
            })?
        }
        Ok(())
    }

    #[instrument(skip(self), err, level = "trace")]
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

    #[instrument(skip(self), err, ret, level = "trace")]
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

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn edit_slot(&self, slot_id: i32, updates: PartialSlot) -> Result<Slot, RepoError> {
        let rq_head = "UPDATE slot SET\n";
        let rq_tail = r#"RETURNING
    slot_id,
    slot_starts_at,
    slot_ends_at,
    wlist_id"#;
        // todo!("this isn't the code to edit a slot, it needs to be written");
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_if_some("slot_starts_at", updates.slot_starts_at)?;
        generator.add_if_some("slot_ends_at", updates.slot_ends_at)?;
        generator.add_if_some("wlist_id", updates.wlist_id)?;
        generator.add_where("slot_id", slot_id)?;
        if !generator.has_assignments() {
            return Err(RepoError::EmptyUpdates {
                context: "edit_slot",
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
