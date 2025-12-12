use super::{RepoError, Repository};
use chrono::prelude::*;
use tracing::{debug, error, warn};

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
    pub async fn get_waiting_list_by_id(&self, id: i32) -> Result<WaitingList, RepoError> {
        let waiting_list = sqlx::query_as(
            "SELECT wlist_id, wlist_secret, wlist_name, wlist_opens_at, wlist_closes_at FROM waiting_list WHERE wlist_id = $1",
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await.map_err(|e| RepoError::Sqlx { error: e, context: "get_waiting_list_by_id" })?;
        Ok(waiting_list)
    }

    pub async fn get_waiting_list_by_secret(&self, secret: &str) -> Result<WaitingList, RepoError> {
        let waiting_list = sqlx::query_as(
            "SELECT wlist_id, wlist_secret, wlist_name, wlist_opens_at, wlist_closes_at FROM waiting_list WHERE wlist_secret = $1",
        )
            .bind(secret)
            .fetch_one(&self.pool)
            .await.map_err(|e| RepoError::Sqlx { error: e, context: "get_waiting_list_by_secret" })?;
        Ok(waiting_list)
    }

    pub async fn create_waiting_list(
        &self,
        admin_token: &str,
        name: &str,
    ) -> Result<WaitingList, RepoError> {
        let waiting_list = sqlx::query_as(
            r#"INSERT INTO waiting_list(wlist_secret, wlist_name)
VALUES ($1, $2)
RETURNING wlist_id, wlist_name, wlist_secret, wlist_opens_at, wlist_closes_at"#,
        )
        .bind(admin_token)
        .bind(name)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Sqlx {
            error: e,
            context: "create_waiting_list",
        })?;
        Ok(waiting_list)
    }

    pub async fn edit_waiting_list(
        &self,
        admin_token: &str,
        updates: PartialWaitingList,
    ) -> Result<WaitingList, RepoError> {
        let rq_head = "UPDATE waiting_list SET\n";
        let rq_tail = r#"
RETURNING
    wlist_id,
    wlist_name,
    wlist_secret,
    wlist_opens_at,
    wlist_closes_at
            "#;
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_if_some("wlist_name", updates.wlist_name)?;
        generator.add_if_some("wlist_opens_at", updates.wlist_opens_at)?;
        generator.add_if_some("wlist_closes_at", updates.wlist_closes_at)?;
        generator.add_where("wlist_secret", admin_token)?;
        if generator.bind_idx <= 2 {
            return Err(RepoError::EmptyUpdates {
                context: "edit_waiting_list",
            });
        }
        let rq = format!("{rq_head}{}{rq_tail}", generator.build_rq_str());
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
