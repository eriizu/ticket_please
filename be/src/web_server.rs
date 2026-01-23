use std::sync::Arc;
use tracing::error;
mod dto;
mod etag;
mod handlers;
use handlers::*;

use poem::{EndpointExt, Route, Server, delete, get, listener::TcpListener, patch, post};

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
        .at(
            "/list",
            get(waiting_list_get_many).post(waiting_list_create),
        )
        .at(
            "/list/:id",
            get(waiting_list_get)
                .patch(waiting_list_patch)
                .delete(waiting_list_delete),
        )
        .at("/list/:secret/invite", get(waiting_list_invite_get))
        .at(
            "/list_master/:parent_secret/child",
            post(list_master_child_create),
        )
        .at(
            "/list_master/:parent_secret/child/:child_id",
            delete(list_master_child_delete),
        )
        .at(
            "/list/:list_secret/token/:token_id",
            patch(waiting_token_edit_as_admin),
        )
        .at(
            "/list/:list_secret/slots/gen",
            post(slots_generate_on_waiting_list),
        )
        .at("/list/:list_secret/slots/:slot_id", delete(slot_delete))
        .at("/list/:id/reg", post(waiting_token_create))
        .at(
            "/token/:secret",
            get(waiting_token_get)
                .patch(waiting_token_edit_as_client)
                .delete(waiting_token_delete),
        )
        .at("/slot/:id", get(slot_get))
        .data(repo)
        .with(poem::middleware::Tracing)
        .with(poem::middleware::RequestId::default())
        .with(etag::EtagMiddleware);
    Server::new(TcpListener::bind("0.0.0.0:3000"))
        .run(routes)
        .await?;
    Ok(())
}
