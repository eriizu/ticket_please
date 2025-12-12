use std::sync::Arc;
use tracing::error;
mod dto;
mod handlers;
use handlers::*;

use poem::{EndpointExt, Route, Server, get, listener::TcpListener, patch, post};

type ArcRepo = Arc<crate::db::Repository>;

#[derive(thiserror::Error, Debug)]
enum HandlerError {
    #[error("failed to generate random admin token {0}")]
    RandomGeneration(getrandom::Error),
    #[error("{context}: not found entry in context")]
    NotFound { context: &'static str },
    #[error("{context}: conflicting state between database and user request")]
    Conflict { context: &'static str },
    #[error("{context}: user request is incoherent with database state")]
    Discrepancy { context: &'static str },
    #[error("{why}")]
    BadRequest {
        why: &'static str,
        context: &'static str,
    },
    #[error(
        "{context}: unspecified error, if you belive there is something wrong with the server, contact support"
    )]
    Unknown { context: &'static str },
}

impl poem::error::ResponseError for HandlerError {
    fn status(&self) -> poem::http::StatusCode {
        use poem::http::StatusCode;
        match self {
            Self::RandomGeneration(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::NotFound { context: _ } => StatusCode::NOT_FOUND,
            Self::Conflict { context: _ } => StatusCode::CONFLICT,
            Self::Discrepancy { context: _ } => StatusCode::CONFLICT,
            Self::BadRequest { why: _, context: _ } => StatusCode::BAD_REQUEST,
            Self::Unknown { context: _ } => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn as_response(&self) -> poem::Response
    where
        Self: std::error::Error + Send + Sync + 'static,
    {
        poem::Response::builder()
            .status(self.status())
            .body(self.to_string())
    }
}

impl std::convert::From<crate::db::RepoError> for HandlerError {
    fn from(value: crate::db::RepoError) -> Self {
        use crate::db::RepoError;
        match value {
            RepoError::NotFound { context } => Self::NotFound { context },
            RepoError::EmptyUpdates { context } => Self::BadRequest {
                why: "empty updates",
                context,
            },
            RepoError::ArgumentEncode(name, _) => Self::BadRequest {
                why: "cannot convert argument to SQL",
                context: name,
            },
            RepoError::Sqlx { error, context } => match error {
                sqlx::Error::RowNotFound => Self::NotFound { context },
                sqlx::Error::Database(error)
                    if error.kind() == sqlx::error::ErrorKind::ForeignKeyViolation =>
                {
                    Self::NotFound { context }
                }
                sqlx::Error::Database(error)
                    if error.kind() == sqlx::error::ErrorKind::UniqueViolation =>
                {
                    Self::Conflict { context }
                }
                _ => {
                    error!("sqlx error translates to unkown error for the handler {error}");
                    Self::Unknown { context }
                }
            },
        }
    }
}

pub async fn start(repo: Arc<crate::db::Repository>) -> anyhow::Result<()> {
    let routes = Route::new()
        .at("/", get(index))
        .at("/wl/:id", get(get_waiting_list).patch(patch_waiting_list))
        .at("/wl/:wl_secret/wt/:wt_id", edit_waiting_token_as_admin)
        .at("/wl", post(create_waiting_list))
        .at("/wl/:id/registration", post(create_waiting_token))
        .at("/wt/:secret", patch(edit_waiting_token_as_client))
        .data(repo)
        .with(poem::middleware::Tracing);
    Server::new(TcpListener::bind("0.0.0.0:3000"))
        .run(routes)
        .await?;
    Ok(())
}
