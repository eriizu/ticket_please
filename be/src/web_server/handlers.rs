use super::{ArcRepo, HandlerError, dto::*};
use chrono::prelude::*;
use poem::web::{Data, Json, Path};

#[poem::handler]
pub async fn index() -> String {
    "Hello".to_owned()
}

#[poem::handler]
pub async fn get_waiting_list(
    Path(id): Path<i32>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<WaitingListWithWaitingTokensDto>, HandlerError> {
    let waiting_list = repo.get_waiting_list_by_id(id).await?;
    let waiting_tokens = repo
        .get_waiting_tokens_per_list(id)
        .await?
        .drain(..)
        .map(|item| item.into())
        .collect();
    Ok(Json(WaitingListWithWaitingTokensDto {
        base: waiting_list.into(),
        waiting_tokens,
    }))
}

#[poem::handler]
pub async fn create_waiting_list(
    Json(input): Json<CreateWaitingListDto>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<WaitingListWithSecretDto>, HandlerError> {
    Ok(Json(
        repo.create_waiting_list(&generate_secret()?, &input.name)
            .await?
            .into(),
    ))
}

#[poem::handler]
pub async fn patch_waiting_list(
    Path(admin_token): Path<String>,
    Data(repo): Data<&ArcRepo>,
    Json(updates): Json<PatchWaitingListDto>,
) -> Result<Json<WaitingListBaseDto>, HandlerError> {
    Ok(Json(
        repo.edit_waiting_list(&admin_token, updates.into())
            .await?
            .into(),
    ))
}

#[poem::handler]
pub async fn create_waiting_token(
    Path(list_id): Path<i32>,
    Data(repo): Data<&ArcRepo>,
    body: Option<Json<AskWaitingTokenDto>>,
) -> Result<Json<WaitingTokenWithSecretDto>, HandlerError> {
    let (client_name, slot_id) = match body {
        Some(Json(body)) => (body.client_name, body.slot_id),
        None => (None, None),
    };
    let est_turn_time = if let Some(slot_id) = slot_id {
        Some(get_slot_start_time_if_same_wlist(repo, slot_id, list_id).await?)
    } else {
        None
    };
    Ok(Json(
        repo.create_waiting_token(
            &generate_secret()?,
            list_id,
            client_name,
            slot_id,
            est_turn_time,
        )
        .await?
        .into(),
    ))
}

fn generate_secret() -> Result<String, HandlerError> {
    use base64::Engine as _;
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(HandlerError::RandomGeneration)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf))
}

async fn check_same_list_token_and_slot(
    repo: &ArcRepo,
    slot_id: i32,
    waiting_token_criteria: crate::db::WaitingTokenCriteria,
) -> Result<(), HandlerError> {
    // TODO: is that correct?
    let slot = repo.get_slot_by_id(slot_id).await?;
    let waiting_token = repo.get_waiting_token(waiting_token_criteria).await?;
    if slot.wlist_id != waiting_token.wlist_id {
        Err(HandlerError::Discrepancy {
            context: "checking slot is part of waiting list",
        })
    } else {
        Ok(())
    }
}

async fn get_slot_start_time_if_same_wlist(
    repo: &ArcRepo,
    slot_id: i32,
    wlist_id: i32,
) -> Result<DateTime<FixedOffset>, HandlerError> {
    let slot = repo.get_slot_by_id(slot_id).await?;
    if slot.wlist_id != wlist_id {
        Err(HandlerError::Discrepancy {
            context: "checking slot is part of waiting list",
        })
    } else {
        Ok(slot.slot_starts_at)
    }
}

#[poem::handler]
pub async fn edit_waiting_token_as_client(
    Path(secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<AskWaitingTokenDto>,
) -> Result<Json<WaitingTokenBaseDto>, HandlerError> {
    let criteria = crate::db::WaitingTokenCriteria::Secret(secret);
    let mut updates: crate::db::EditWaitingToken = body.into();
    if let Some(slot_id) = updates.slot_id {
        let waiting_token = repo.get_waiting_token(criteria.clone()).await?;
        updates.wtoken_est_turn_time =
            Some(get_slot_start_time_if_same_wlist(repo, slot_id, waiting_token.wlist_id).await?);
    }
    Ok(Json(
        repo.edit_waiting_token_2(criteria, updates).await?.into(),
    ))
}

#[derive(serde::Deserialize)]
struct EditWaitingParams {
    wl_secret: String,
    wt_id: i32,
}

#[poem::handler]
pub async fn edit_waiting_token_as_admin(
    Path(params): Path<EditWaitingParams>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<EditWaitingTokenDto>,
) -> Result<Json<WaitingTokenBaseDto>, HandlerError> {
    let waiting_list = repo.get_waiting_list_by_secret(&params.wl_secret).await?;
    let criteria = crate::db::WaitingTokenCriteria::Id(params.wt_id);
    let mut updates: crate::db::EditWaitingToken = body.into();
    if let Some(slot_id) = updates.slot_id {
        let wtoken_est_turn_time =
            Some(get_slot_start_time_if_same_wlist(repo, slot_id, waiting_list.wlist_id).await?);
        if let None = updates.wtoken_est_turn_time {
            updates.wtoken_est_turn_time = wtoken_est_turn_time;
        }
    }
    Ok(Json(
        repo.edit_waiting_token_2(criteria, updates).await?.into(),
    ))
}
