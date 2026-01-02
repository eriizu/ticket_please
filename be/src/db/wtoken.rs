use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::{debug, instrument};

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct WaitingToken {
    pub wtoken_id: i32,
    pub wtoken_secret: String,
    pub wtoken_client_name: Option<String>,
    pub wtoken_generated_at: DateTime<FixedOffset>,
    pub wtoken_est_turn_time: Option<DateTime<FixedOffset>>,
    pub wtoken_real_turn_time: Option<DateTime<FixedOffset>>,
    pub slot_id: Option<i32>,
    pub wlist_id: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct EditWaitingToken {
    pub wtoken_client_name: Option<String>,
    pub wtoken_est_turn_time: Option<DateTime<FixedOffset>>,
    pub wtoken_real_turn_time: Option<DateTime<FixedOffset>>,
    pub slot_id: Option<i32>,
}

#[derive(Clone, Debug)]
pub enum WaitingTokenCriteria {
    Id(i32),
    Secret(String),
}

impl WaitingTokenCriteria {
    fn sql_field_name(&self) -> &'static str {
        match self {
            WaitingTokenCriteria::Id(_) => "wtoken_id",
            WaitingTokenCriteria::Secret(_) => "wtoken_secret",
        }
    }
}

impl Repository {
    #[instrument(skip(self), err, ret)]
    pub async fn get_waiting_token(
        &self,
        criteria: WaitingTokenCriteria,
    ) -> Result<WaitingToken, RepoError> {
        let rq = format!(
            r#"select
    wtoken_id,
    wtoken_secret,
    wtoken_client_name,
    wtoken_generated_at,
    wtoken_est_turn_time,
    wtoken_real_turn_time,
    wlist_id,
    slot_id
from waiting_token
where {} = $1
    "#,
            criteria.sql_field_name()
        );
        Ok(match criteria {
            WaitingTokenCriteria::Id(id) => {
                sqlx::query_as(&rq).bind(id).fetch_one(&self.pool).await
            }
            WaitingTokenCriteria::Secret(secret) => {
                sqlx::query_as(&rq).bind(secret).fetch_one(&self.pool).await
            }
        }
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_waiting_token",
        })?)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn create_waiting_token(
        &self,
        wtoken_secret: &str,
        wlist_id: i32,
        client_name: Option<String>,
        slot_id: Option<i32>,
        estimated_turn_time: Option<DateTime<FixedOffset>>,
    ) -> Result<WaitingToken, RepoError> {
        let waiting_token = sqlx::query_as(
            r#"
INSERT INTO waiting_token(wtoken_secret, wlist_id, wtoken_client_name, slot_id, wtoken_est_turn_time)
VALUES ($1, $2, $3, $4, $5)
RETURNING
    wtoken_id,
    wtoken_secret,
    wtoken_client_name,
    wtoken_generated_at,
    wtoken_est_turn_time,
    wtoken_real_turn_time,
    wlist_id,
    slot_id"#,
        )
            .bind(wtoken_secret)
            .bind(wlist_id)
            .bind(client_name)
            .bind(slot_id)
            .bind(estimated_turn_time)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "create_waiting_token",
        })?;

        Ok(waiting_token)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn edit_waiting_token_2(
        &self,
        criteria: WaitingTokenCriteria,
        updates: EditWaitingToken,
    ) -> Result<WaitingToken, RepoError> {
        let rq_head = "UPDATE waiting_token SET";
        let rq_tail = r#"RETURNING
    wtoken_id,
    wtoken_secret,
    wtoken_client_name,
    wtoken_generated_at,
    wtoken_est_turn_time,
    wtoken_real_turn_time,
    wlist_id,
    slot_id"#;
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_if_some("wtoken_client_name", updates.wtoken_client_name)?;
        generator.add_if_some("wtoken_est_turn_time", updates.wtoken_est_turn_time)?;
        generator.add_if_some("wtoken_real_turn_time", updates.wtoken_real_turn_time)?;
        generator.add_if_some("slot_id", updates.slot_id)?;
        match criteria {
            WaitingTokenCriteria::Id(id) => generator.add_where("wtoken_id", id)?,
            WaitingTokenCriteria::Secret(secret) => generator.add_where("wtoken_secret", secret)?,
        }
        if !generator.has_assignments() {
            return Err(RepoError::EmptyUpdates {
                context: "edit_waiting_token",
            });
        }
        let rq = format!("{rq_head}\n{}\n{rq_tail}", generator.build_rq_str());
        debug!("edit request built: {}", rq);
        Ok(sqlx::query_as_with(&rq, generator.args)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_waiting_token",
            })?)
    }

    #[instrument(skip(self), err)]
    pub async fn get_waiting_tokens_per_list(
        &self,
        list_id: i32,
    ) -> Result<Vec<WaitingToken>, RepoError> {
        let waiting_tokens = sqlx::query_as(
            r#"SELECT
    wtoken_id,
    wtoken_secret,
    wtoken_client_name,
    wtoken_generated_at,
    wtoken_est_turn_time,
    wtoken_real_turn_time,
    wlist_id,
    slot_id
FROM waiting_token
WHERE wlist_id = $1"#,
        )
        .bind(list_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_waiting_tokens_per_list",
        })?;
        Ok(waiting_tokens)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn delete_waiting_token(&self, secret: String) -> Result<(), RepoError> {
        let db_response =
            sqlx::query!("DELETE FROM waiting_token WHERE wtoken_secret = $1", secret)
                .execute(&self.pool)
                .await
                .map_err(|e| RepoError::Sqlx {
                    error: e,
                    context: std::module_path!(),
                })?;
        if db_response.rows_affected() == 0 {
            Err(RepoError::NotFound {
                context: "delete_waiting_token",
            })?
        }
        Ok(())
    }
}
