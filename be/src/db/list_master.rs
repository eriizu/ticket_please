use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::{debug, instrument};

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct ListMaster {
    pub lm_id: i32,
    pub lm_secret: String,
    pub lm_name: String,
    pub lm_parent: Option<i32>,
    pub lm_deleted_at: Option<DateTime<FixedOffset>>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct PartialListMaster {
    pub lm_name: Option<String>,
    pub lm_parent: Option<i32>,
    pub lm_secret: Option<String>,
}

impl Repository {
    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_all_list_master(&self) -> Result<Vec<ListMaster>, RepoError> {
        let list_master = sqlx::query_as(
            r#"SELECT lm_id, lm_secret, lm_name, lm_parent, lm_deleted_at
FROM list_master
WHERE lm_deleted_at IS NULL"#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_all_list_master",
        })?;
        Ok(list_master)
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_list_master_by_parent(
        &self,
        parent_id: i32,
    ) -> Result<Vec<ListMaster>, RepoError> {
        let list_master = sqlx::query_as(
            r#"SELECT lm_id, lm_secret, lm_name, lm_parent, lm_deleted_at
FROM list_master
WHERE lm_parent = $1
  AND lm_deleted_at IS NULL"#,
        )
        .bind(parent_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_list_master_by_parent",
        })?;
        Ok(list_master)
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_root_list_master(&self) -> Result<Vec<ListMaster>, RepoError> {
        let list_master = sqlx::query_as(
            r#"SELECT lm_id, lm_secret, lm_name, lm_parent, lm_deleted_at
FROM list_master
WHERE lm_parent IS NULL
  AND lm_deleted_at IS NULL"#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_root_list_master",
        })?;
        Ok(list_master)
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_list_master_by_id(&self, id: i32) -> Result<ListMaster, RepoError> {
        let list_master = sqlx::query_as(
            r#"SELECT lm_id, lm_secret, lm_name, lm_parent, lm_deleted_at
FROM list_master
WHERE lm_id = $1
  AND lm_deleted_at IS NULL"#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_list_master_by_id",
        })?;
        Ok(list_master)
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_list_master_by_secret(&self, secret: &str) -> Result<ListMaster, RepoError> {
        let list_master = sqlx::query_as(
            r#"SELECT lm_id, lm_secret, lm_name, lm_parent, lm_deleted_at
FROM list_master
WHERE lm_secret = $1
  AND lm_deleted_at IS NULL"#,
        )
        .bind(secret)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "get_list_master_by_secret",
        })?;
        Ok(list_master)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn create_list_master(
        &self,
        admin_token: &str,
        name: &str,
        parent: Option<i32>,
    ) -> Result<ListMaster, RepoError> {
        let list_master = sqlx::query_as(
            r#"INSERT INTO list_master(lm_secret, lm_name, lm_parent)
VALUES ($1, $2, $3)
RETURNING lm_id, lm_secret, lm_name, lm_parent, lm_deleted_at"#,
        )
        .bind(admin_token)
        .bind(name)
        .bind(parent)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "create_list_master",
        })?;
        Ok(list_master)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn edit_list_master(
        &self,
        admin_token: &str,
        updates: PartialListMaster,
    ) -> Result<ListMaster, RepoError> {
        let rq_head = "UPDATE list_master SET";
        let rq_tail = r#"RETURNING
    lm_id,
    lm_secret,
    lm_name,
    lm_parent,
    lm_deleted_at"#;
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_if_some("lm_name", updates.lm_name)?;
        generator.add_if_some("lm_parent", updates.lm_parent)?;
        generator.add_if_some("lm_secret", updates.lm_secret)?;
        generator.add_where("lm_secret", admin_token)?;
        if !generator.has_assignments() {
            return Err(RepoError::EmptyUpdates {
                context: "edit_list_master",
            });
        }
        generator.add_where_is_null("lm_deleted_at");
        let rq_body = generator.build_rq_str();
        let rq = format!("{rq_head}\n{rq_body}\n{rq_tail}");
        debug!("edit request built: {}", rq);
        let query = sqlx::query_as_with(&rq, generator.args);
        Ok(query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_list_master",
            })?)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn delete_list_master(&self, secret: String) -> Result<(), RepoError> {
        let db_response = sqlx::query(
            "UPDATE list_master SET lm_deleted_at = now() WHERE lm_secret = $1 AND lm_deleted_at IS NULL",
        )
        .bind(secret)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: std::module_path!(),
        })?;
        if db_response.rows_affected() == 0 {
            Err(RepoError::NotFound {
                context: "delete_list_master",
            })?
        }
        Ok(())
    }
}
