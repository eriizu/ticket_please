use chrono::prelude::*;
mod wlist;
use tracing::info;
pub use wlist::*;
mod wtoken;
pub use wtoken::*;
mod slot;
pub use slot::*;
mod list_master;
pub use list_master::*;

use sqlx::migrate::Migrator;

static MIGRATOR: Migrator = sqlx::migrate!(); // defaults to "./migrations"

#[allow(unused)]
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("{context}: not found")]
    NotFound { context: &'static str },
    #[error("{context}: repo error sql: {error}")]
    Sqlx {
        error: sqlx::Error,
        context: &'static str,
    },
    #[error("{context}: empty updates")]
    EmptyUpdates { context: &'static str },
    #[error("{0}: failed to encode argument: {1}")]
    ArgumentEncode(
        &'static str,
        Box<dyn std::error::Error + 'static + Send + Sync>,
    ),
}

pub struct Repository {
    pool: sqlx::PgPool,
}

impl Repository {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }

    pub async fn mig(&self) -> anyhow::Result<()> {
        info!("running migration");
        MIGRATOR.run(&self.pool).await?;
        Ok(())
    }
}

struct EditRequestAndArgsBuilder {
    args: sqlx::postgres::PgArguments,
    names: Vec<String>,
    where_idx: Option<usize>,
    bind_idx: usize,
}

impl EditRequestAndArgsBuilder {
    pub fn new() -> Self {
        Self {
            args: sqlx::postgres::PgArguments::default(),
            names: vec![],
            where_idx: None,
            bind_idx: 1,
        }
    }

    pub fn has_assignments(&self) -> bool {
        if self.where_idx.is_some() {
            (self.names.len() - 1) != 0
        } else {
            self.names.len() != 0
        }
    }

    pub fn add_assignment<T>(&mut self, name: &'static str, val: T) -> Result<(), RepoError>
    where
        T: for<'q> sqlx::Encode<'q, sqlx::Postgres> + sqlx::Type<sqlx::Postgres>,
    {
        use sqlx::Arguments;
        self.args
            .add(val)
            .map_err(|e| RepoError::ArgumentEncode(name, e))?;
        self.names.push(name.to_owned());
        self.bind_idx += 1;
        Ok(())
    }

    pub fn add_if_some<T>(&mut self, name: &'static str, val: Option<T>) -> Result<(), RepoError>
    where
        T: for<'q> sqlx::Encode<'q, sqlx::Postgres> + sqlx::Type<sqlx::Postgres>,
    {
        if let Some(val) = val {
            self.add_assignment(name, val)
        } else {
            Ok(())
        }
    }

    pub fn add_where<T>(&mut self, name: &'static str, val: T) -> Result<(), RepoError>
    where
        T: for<'q> sqlx::Encode<'q, sqlx::Postgres> + sqlx::Type<sqlx::Postgres>,
    {
        use sqlx::Arguments;
        self.args
            .add(val)
            .map_err(|e| RepoError::ArgumentEncode(name, e))?;
        self.names.push(name.to_owned());
        self.where_idx = Some(self.bind_idx);
        self.bind_idx += 1;
        Ok(())
    }

    pub fn build_rq_str(&mut self) -> String {
        let mut rq = String::new();
        let mut count_generated = 0;
        let mut where_clause = None;
        for (idx, name) in self.names.iter().enumerate() {
            if let Some(where_idx) = self.where_idx
                && where_idx == idx + 1
            {
                where_clause = Some(format!("WHERE {} = ${}", name, idx + 1));
            } else {
                rq.push_str(&format!(
                    "{}{} = ${}",
                    if count_generated != 0 { ",\n" } else { "" },
                    name,
                    idx + 1
                ));
                count_generated += 1;
            }
        }
        rq.push('\n');
        if let Some(where_clause) = where_clause {
            rq.push_str(&where_clause);
        }
        rq
    }
}

#[cfg(test)]
mod test {
    #[test]
    fn generate_rq_str_wo_where() {
        let mut generator = super::EditRequestAndArgsBuilder::new();
        assert!(!generator.has_assignments());
        generator.add_assignment("hello", "world").unwrap();
        assert!(generator.has_assignments());
        generator.add_assignment("age", 12).unwrap();
        assert!(generator.has_assignments());
        generator.add_assignment("name", "samuel").unwrap();
        assert!(generator.has_assignments());
        let rq = generator.build_rq_str();
        assert_eq!(
            rq.trim(),
            r#"hello = $1,
age = $2,
name = $3
"#
            .trim()
        );
    }

    #[test]
    fn generate_rq_str_with_where() {
        let mut generator = super::EditRequestAndArgsBuilder::new();
        assert!(!generator.has_assignments());
        generator.add_assignment("hello", "world").unwrap();
        assert!(generator.has_assignments());
        generator.add_assignment("age", 12).unwrap();
        assert!(generator.has_assignments());
        generator.add_assignment("name", "samuel").unwrap();
        assert!(generator.has_assignments());
        generator.add_where("id", 14).unwrap();
        assert!(generator.has_assignments());
        let rq = generator.build_rq_str();
        assert_eq!(
            rq.trim(),
            r#"hello = $1,
age = $2,
name = $3
WHERE id = $4
"#
            .trim()
        );
    }

    #[test]
    fn generate_rq_str_first_where() {
        let mut generator = super::EditRequestAndArgsBuilder::new();
        assert!(!generator.has_assignments());
        generator.add_where("id", 14).unwrap();
        assert!(!generator.has_assignments());
        generator.add_assignment("hello", "world").unwrap();
        assert!(generator.has_assignments());
        generator.add_assignment("age", 12).unwrap();
        assert!(generator.has_assignments());
        generator.add_assignment("name", "samuel").unwrap();
        assert!(generator.has_assignments());
        let rq = generator.build_rq_str();
        assert_eq!(
            rq.trim(),
            r#"hello = $2,
age = $3,
name = $4
WHERE id = $1
"#
            .trim()
        );
    }

    #[test]
    fn generate_rq_str_middle_where() {
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_assignment("hello", "world").unwrap();
        generator.add_where("id", 14).unwrap();
        generator.add_assignment("age", 12).unwrap();
        generator.add_assignment("name", "samuel").unwrap();
        let rq = generator.build_rq_str();
        assert_eq!(
            rq.trim(),
            r#"hello = $1,
age = $3,
name = $4
WHERE id = $2
"#
            .trim()
        );
    }
}

// struct EditQueryBuilder<'q, O> {
//     query: sqlx::query::QueryAs<'q, sqlx::Postgres, O, sqlx::postgres::PgArguments>,
//     args: Vec<Field>,
// }
//
// impl<'q, O> EditQueryBuilder<'q, O> {
//     fn patae(&self) {}
// }
//
// struct Field {
//     name: &'static str,
//     value: FieldValue,
// }
//
// #[derive(derive_more::From)]
// enum FieldValue {
//     I32(i32),
//     Text(String),
//     DateFixedOffset(DateTime<FixedOffset>),
// }
