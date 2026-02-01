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

enum EditClause {
    Assignment { name: String, bind_idx: usize },
    AssignmentNull { name: String },
    Where { name: String, bind_idx: usize },
    WhereNull { name: String },
}

struct EditRequestAndArgsBuilder {
    args: sqlx::postgres::PgArguments,
    clauses: Vec<EditClause>,
    bind_idx: usize,
}

impl EditRequestAndArgsBuilder {
    pub fn new() -> Self {
        Self {
            args: sqlx::postgres::PgArguments::default(),
            clauses: vec![],
            bind_idx: 1,
        }
    }

    pub fn has_assignments(&self) -> bool {
        self.clauses.iter().any(|clause| {
            matches!(
                clause,
                EditClause::Assignment { .. } | EditClause::AssignmentNull { .. }
            )
        })
    }

    pub fn add_assignment<T>(&mut self, name: &'static str, val: T) -> Result<(), RepoError>
    where
        T: for<'q> sqlx::Encode<'q, sqlx::Postgres> + sqlx::Type<sqlx::Postgres>,
    {
        use sqlx::Arguments;
        self.args
            .add(val)
            .map_err(|e| RepoError::ArgumentEncode(name, e))?;
        self.clauses.push(EditClause::Assignment {
            name: name.to_owned(),
            bind_idx: self.bind_idx,
        });
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

    pub fn add_null_assignment(&mut self, name: &'static str) {
        self.clauses.push(EditClause::AssignmentNull {
            name: name.to_owned(),
        });
    }

    pub fn add_where<T>(&mut self, name: &'static str, val: T) -> Result<(), RepoError>
    where
        T: for<'q> sqlx::Encode<'q, sqlx::Postgres> + sqlx::Type<sqlx::Postgres>,
    {
        use sqlx::Arguments;
        self.args
            .add(val)
            .map_err(|e| RepoError::ArgumentEncode(name, e))?;
        self.clauses.push(EditClause::Where {
            name: name.to_owned(),
            bind_idx: self.bind_idx,
        });
        self.bind_idx += 1;
        Ok(())
    }

    pub fn add_where_is_null(&mut self, name: &'static str) {
        self.clauses.push(EditClause::WhereNull {
            name: name.to_owned(),
        });
    }

    pub fn build_rq_str(&mut self) -> String {
        let mut assignments = vec![];
        let mut wheres = vec![];
        for clause in &self.clauses {
            match clause {
                EditClause::Assignment { name, bind_idx } => {
                    assignments.push(format!("{name} = ${bind_idx}"));
                }
                EditClause::AssignmentNull { name } => {
                    assignments.push(format!("{name} = NULL"));
                }
                EditClause::Where { name, bind_idx } => {
                    wheres.push(format!("{name} = ${bind_idx}"));
                }
                EditClause::WhereNull { name } => {
                    wheres.push(format!("{name} IS NULL"));
                }
            }
        }
        let mut rq = assignments.join(",\n");
        rq.push('\n');
        if !wheres.is_empty() {
            rq.push_str("WHERE ");
            rq.push_str(&wheres.join(" AND "));
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

    #[test]
    fn generate_rq_str_multiple_where() {
        let mut generator = super::EditRequestAndArgsBuilder::new();
        generator.add_assignment("hello", "world").unwrap();
        generator.add_where("id", 14).unwrap();
        generator.add_where_is_null("deleted_at");
        generator.add_assignment("age", 12).unwrap();
        let rq = generator.build_rq_str();
        assert_eq!(
            rq.trim(),
            r#"hello = $1,
age = $3
WHERE id = $2 AND deleted_at IS NULL
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
