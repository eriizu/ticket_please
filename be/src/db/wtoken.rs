use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::debug;

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

impl EditWaitingToken {
    fn mk_request(
        &self,
        head: &str,
        tail: &str,
        criteria: &WaitingTokenCriteria,
    ) -> Result<String, RepoError> {
        let mut rq = head.to_owned();
        let start_bind_idx = 1;
        let mut bind_idx = start_bind_idx;
        if self.wtoken_client_name.is_some() {
            rq.push_str(&format!(
                "{}wtoken_client_name = ${}",
                if bind_idx != 1 { ",\n" } else { "" },
                bind_idx
            ));
            bind_idx += 1;
        }
        if self.wtoken_est_turn_time.is_some() {
            rq.push_str(&format!(
                "{}wtoken_est_turn_time= ${}",
                if bind_idx != 1 { ",\n" } else { "" },
                bind_idx
            ));
            bind_idx += 1;
        }
        if self.wtoken_real_turn_time.is_some() {
            rq.push_str(&format!(
                "{}wtoken_real_turn_time = ${}",
                if bind_idx != 1 { ",\n" } else { "" },
                bind_idx
            ));
            bind_idx += 1;
        }
        if self.slot_id.is_some() {
            rq.push_str(&format!(
                "{}slot_id = ${}",
                if bind_idx != 1 { ",\n" } else { "" },
                bind_idx
            ));
            bind_idx += 1;
        }
        if start_bind_idx == bind_idx {
            return Err(RepoError::EmptyUpdates {
                context: "edit_waiting_token",
            });
        }
        rq.push_str(&format!(
            "\nWHERE {} = ${}\n",
            criteria.sql_field_name(),
            bind_idx
        ));
        rq.push_str(tail);
        Ok(rq)
    }

    fn bind_to_query<'a>(
        &'a self,
        mut query: sqlx::query::QueryAs<
            'a,
            sqlx::Postgres,
            WaitingToken,
            sqlx::postgres::PgArguments,
        >,
        criteria: &'a WaitingTokenCriteria,
    ) -> sqlx::query::QueryAs<'a, sqlx::Postgres, WaitingToken, sqlx::postgres::PgArguments> {
        if let Some(value) = &self.wtoken_client_name {
            query = query.bind(value);
        }
        if let Some(value) = self.wtoken_est_turn_time {
            query = query.bind(value);
        }
        if let Some(value) = self.wtoken_real_turn_time {
            query = query.bind(value);
        }
        if let Some(value) = self.slot_id {
            query = query.bind(value);
        }
        match criteria {
            WaitingTokenCriteria::Id(id) => query.bind(id),
            WaitingTokenCriteria::Secret(secret) => query.bind(secret),
        }
    }
}

#[derive(Clone)]
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
where {} is $1
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

    pub async fn edit_waiting_token(
        &self,
        criteria: WaitingTokenCriteria,
        updates: EditWaitingToken,
    ) -> Result<WaitingToken, RepoError> {
        let rq_head = "UPDATE waiting_token SET\n";
        let rq_tail = r#"
RETURNING
    wtoken_id,
    wtoken_secret,
    wtoken_client_name,
    wtoken_generated_at,
    wtoken_est_turn_time,
    wtoken_real_turn_time,
    wlist_id,
    slot_id"#;
        let rq = updates.mk_request(rq_head, rq_tail, &criteria)?;
        debug!("edit request built: {}", rq);
        let mut query = sqlx::query_as(&rq);
        // WARN: value bind order is determined by mk_request's contents.
        if let Some(value) = updates.wtoken_client_name {
            query = query.bind(value);
        }
        if let Some(value) = updates.wtoken_est_turn_time {
            query = query.bind(value);
        }
        if let Some(value) = updates.wtoken_real_turn_time {
            query = query.bind(value);
        }
        if let Some(value) = updates.slot_id {
            query = query.bind(value);
        }
        let patate: sqlx::query::QueryAs<
            sqlx::Postgres,
            WaitingTokenCriteria,
            sqlx::postgres::PgArguments,
        >;
        Ok(match criteria {
            WaitingTokenCriteria::Id(id) => {
                query
                    .bind(id)
                    .fetch_one(&self.pool)
                    .await
                    .map_err(|e| RepoError::Sqlx {
                        error: e,
                        context: "edit_waiting_token",
                    })?
            }
            WaitingTokenCriteria::Secret(secret) => query
                .bind(secret)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| RepoError::Sqlx {
                    error: e,
                    context: "edit_waiting_token",
                })?,
        })
    }

    pub async fn edit_waiting_token_1(
        &self,
        criteria: WaitingTokenCriteria,
        updates: EditWaitingToken,
    ) -> Result<WaitingToken, RepoError> {
        let rq_head = "UPDATE waiting_token SET\n";
        let rq_tail = r#"
RETURNING
    wtoken_id,
    wtoken_secret,
    wtoken_client_name,
    wtoken_generated_at,
    wtoken_est_turn_time,
    wtoken_real_turn_time,
    wlist_id,
    slot_id"#;
        let rq = updates.mk_request(rq_head, rq_tail, &criteria)?;
        debug!("edit request built: {}", rq);
        let query = sqlx::query_as(&rq);
        Ok(updates
            .bind_to_query(query, &criteria)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_waiting_token",
            })?)
    }

    pub async fn edit_waiting_token_2(
        &self,
        criteria: WaitingTokenCriteria,
        updates: EditWaitingToken,
    ) -> Result<WaitingToken, RepoError> {
        let rq_head = "UPDATE waiting_token SET\n";
        let rq_tail = r#"
RETURNING
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
        let rq = format!("{rq_head}{}{rq_tail}", generator.build_rq_str());
        Ok(sqlx::query_as_with(&rq, generator.args)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_waiting_token",
            })?)
    }

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
}
