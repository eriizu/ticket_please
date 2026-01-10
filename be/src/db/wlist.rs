use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::{debug, error, instrument, warn};

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct WaitingList {
    pub wlist_id: i32,
    pub wlist_secret: String,
    pub wlist_name: String,
    pub wlist_opens_at: Option<DateTime<FixedOffset>>,
    pub wlist_closes_at: Option<DateTime<FixedOffset>>,
}

impl WaitingList {
    pub fn is_open(&self, now: DateTime<Utc>) -> bool {
        let has_openned = self.wlist_opens_at.map(|opens| opens < now);
        let has_closed = self.wlist_closes_at.map(|closes| now > closes);
        match (has_openned, has_closed) {
            (Some(has_openned), Some(has_closed)) if has_openned && !has_closed => true,
            (Some(has_openned), Some(has_closed)) if !has_openned || has_closed => false,
            (Some(has_openned), None) => has_openned,
            (None, Some(_)) => {
                warn!(
                    "on waiting list {}, closes_at is set but opens_at is not, considering list is not open",
                    self.wlist_id
                );
                false
            }
            _ => false,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct PartialWaitingList {
    pub wlist_name: Option<String>,
    pub wlist_opens_at: Option<DateTime<FixedOffset>>,
    pub wlist_closes_at: Option<DateTime<FixedOffset>>,
}

impl Repository {
    #[instrument(skip(self), err, level = "trace")]
    pub async fn get_all_waiting_list(&self, open: bool) -> Result<Vec<WaitingList>, RepoError> {
        use futures_util::StreamExt;
        let now = Utc::now();
        let mut waiting_list = sqlx::query_as::<_, WaitingList>(
            "SELECT wlist_id, wlist_secret, wlist_name, wlist_opens_at, wlist_closes_at FROM waiting_list WHERE wlist_closes_at is null OR wlist_closes_at > $1",
        )
            .bind(now)
            .fetch(&self.pool);
        let mut out = vec![];
        while let Some(row) = waiting_list.next().await {
            let row = row.map_err(|e| RepoError::Sqlx {
                error: e,
                context: "get_waiting_list_by_id",
            })?;
            // if row.is_open(now) == open {
            //     out.push(row);
            // }
            out.push(row);
        }
        Ok(out)
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_waiting_list_by_id(&self, id: i32) -> Result<WaitingList, RepoError> {
        let waiting_list = sqlx::query_as(
            "SELECT wlist_id, wlist_secret, wlist_name, wlist_opens_at, wlist_closes_at FROM waiting_list WHERE wlist_id = $1",
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await.map_err(|e| RepoError::Sqlx { error: e, context: "get_waiting_list_by_id" })?;
        Ok(waiting_list)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn delete_waiting_list(&self, secret: String) -> Result<(), RepoError> {
        let db_response = sqlx::query!("DELETE FROM waiting_list WHERE wlist_secret = $1", secret)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: std::module_path!(),
            })?;
        if db_response.rows_affected() == 0 {
            Err(RepoError::NotFound {
                context: "delete_waiting_list",
            })?
        }
        Ok(())
    }

    #[instrument(skip(self), err, ret, level = "trace")]
    pub async fn get_waiting_list_by_secret(&self, secret: &str) -> Result<WaitingList, RepoError> {
        let waiting_list = sqlx::query_as(
            "SELECT wlist_id, wlist_secret, wlist_name, wlist_opens_at, wlist_closes_at FROM waiting_list WHERE wlist_secret = $1",
        )
            .bind(secret)
            .fetch_one(&self.pool)
            .await.map_err(|e| RepoError::Sqlx { error: e, context: "get_waiting_list_by_secret" })?;
        Ok(waiting_list)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn create_waiting_list(
        &self,
        admin_token: &str,
        name: &str,
        opens_at: Option<DateTime<FixedOffset>>,
        closes_at: Option<DateTime<FixedOffset>>,
    ) -> Result<WaitingList, RepoError> {
        let waiting_list = sqlx::query_as(
            r#"INSERT INTO waiting_list(wlist_secret, wlist_name, wlist_opens_at, wlist_closes_at)
VALUES ($1, $2, $3, $4)
RETURNING wlist_id, wlist_name, wlist_secret, wlist_opens_at, wlist_closes_at"#,
        )
        .bind(admin_token)
        .bind(name)
        .bind(opens_at)
        .bind(closes_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "create_waiting_list",
        })?;
        Ok(waiting_list)
    }

    #[instrument(skip(self), err, ret)]
    pub async fn edit_waiting_list(
        &self,
        admin_token: &str,
        updates: PartialWaitingList,
    ) -> Result<WaitingList, RepoError> {
        let rq_head = "UPDATE waiting_list SET";
        let rq_tail = r#"RETURNING
    wlist_id,
    wlist_name,
    wlist_secret,
    wlist_opens_at,
    wlist_closes_at"#;
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_if_some("wlist_name", updates.wlist_name)?;
        generator.add_if_some("wlist_opens_at", updates.wlist_opens_at)?;
        generator.add_if_some("wlist_closes_at", updates.wlist_closes_at)?;
        generator.add_where("wlist_secret", admin_token)?;
        if !generator.has_assignments() {
            return Err(RepoError::EmptyUpdates {
                context: "edit_waiting_list",
            });
        }
        let rq = format!("{rq_head}\n{}\n{rq_tail}\n", generator.build_rq_str());
        debug!("edit request built: {}", rq);
        let query = sqlx::query_as_with(&rq, generator.args);
        Ok(query
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Sqlx {
                error: e,
                context: "edit_waiting_list",
            })?)
    }
}

#[cfg(test)]
mod t {
    use chrono::{TimeDelta, prelude::*};
    fn mk_date(minutes: i64, now: DateTime<Utc>) -> DateTime<FixedOffset> {
        let delta = TimeDelta::minutes(minutes);
        return (now + delta).fixed_offset();
    }
    #[test]
    fn wl_isopen() {
        let now = Utc::now();
        let mut wl = super::WaitingList {
            wlist_id: 1,
            wlist_secret: String::new(),
            wlist_name: String::new(),
            wlist_opens_at: Some(mk_date(-1, now)),
            wlist_closes_at: Some(mk_date(1, now)),
        };
        assert!(wl.is_open(now), "{:#?}", wl);

        wl.wlist_closes_at = None;
        assert!(wl.is_open(now), "{:#?}", wl);

        wl.wlist_opens_at = None;
        wl.wlist_closes_at = Some(mk_date(1, now));
        assert!(!wl.is_open(now), "{:#?}", wl);

        wl.wlist_opens_at = None;
        wl.wlist_closes_at = Some(mk_date(-1, now));
        assert!(!wl.is_open(now), "{:#?}", wl);

        wl.wlist_opens_at = Some(mk_date(-1, now));
        wl.wlist_closes_at = None;
        assert!(wl.is_open(now), "{:#?}", wl);

        wl.wlist_opens_at = Some(mk_date(2, now));
        wl.wlist_closes_at = Some(mk_date(4, now));
        assert!(!wl.is_open(now), "{:#?}", wl);

        wl.wlist_opens_at = Some(mk_date(-3, now));
        wl.wlist_closes_at = Some(mk_date(-1, now));
        assert!(!wl.is_open(now), "{:#?}", wl);
    }
}
