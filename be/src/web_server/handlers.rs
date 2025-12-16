use super::{ArcRepo, HandlerError, dto::*};
use chrono::{Duration, prelude::*};
use poem::web::{Data, Json, Path};

#[poem::handler]
pub async fn index() -> String {
    "Hello".to_owned()
}

#[poem::handler]
pub async fn get_waiting_list(
    Path(id): Path<i32>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<WaitingListWithRelatedDto>, HandlerError> {
    let waiting_list = repo.get_waiting_list_by_id(id).await?;
    let waiting_tokens = repo
        .get_waiting_tokens_per_list(id)
        .await?
        .drain(..)
        .map(|item| item.into())
        .collect();
    let slots = repo
        .get_slot_by_list_id(id)
        .await?
        .drain(..)
        .map(|x| x.into())
        .collect();
    Ok(Json(WaitingListWithRelatedDto {
        base: waiting_list.into(),
        waiting_tokens,
        slots,
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
    let waiting_list = repo.get_waiting_list_by_id(list_id).await?;
    let mut est_turn_time = None;
    let mut slot = if let Some(slot_id) = slot_id {
        let slot = repo.get_slot_by_id(slot_id).await?;
        if slot.wlist_id != list_id {
            Err(HandlerError::Discrepancy {
                context: "checking slot is part of waiting list",
            })?;
        }
        est_turn_time = Some(slot.slot_starts_at);
        Some(slot)
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
        .await
        .map(|token| (token, waiting_list, slot))?
        .into(),
    ))
}

fn generate_secret() -> Result<String, HandlerError> {
    use base64::Engine as _;
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(HandlerError::RandomGeneration)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf))
}

#[poem::handler]
pub async fn edit_waiting_token_as_client(
    Path(secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<AskWaitingTokenDto>,
) -> Result<Json<WaitingTokenWithRelatedDto>, HandlerError> {
    let criteria = crate::db::WaitingTokenCriteria::Secret(secret);
    let mut updates: crate::db::EditWaitingToken = body.into();
    let mut slot = if let Some(slot_id) = updates.slot_id {
        let slot = repo.get_slot_by_id(slot_id).await?;
        let waiting_token = repo.get_waiting_token(criteria.clone()).await?;
        if slot.wlist_id != waiting_token.wlist_id {
            Err(HandlerError::Discrepancy {
                context: "checking slot is part of waiting list",
            })?;
        }
        updates.wtoken_est_turn_time = Some(slot.slot_starts_at);
        Some(slot)
    } else {
        None
    };
    let updated_waiting_token = repo.edit_waiting_token_2(criteria, updates).await?;
    let waiting_list = repo
        .get_waiting_list_by_id(updated_waiting_token.wlist_id)
        .await?;
    Ok(Json((updated_waiting_token, waiting_list, slot).into()))
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
) -> Result<Json<WaitingTokenWithRelatedDto>, HandlerError> {
    let criteria = crate::db::WaitingTokenCriteria::Id(params.wt_id);
    let mut updates: crate::db::EditWaitingToken = body.into();
    let mut slot = if let Some(slot_id) = updates.slot_id {
        let slot = repo.get_slot_by_id(slot_id).await?;
        let waiting_token = repo.get_waiting_token(criteria.clone()).await?;
        if slot.wlist_id != waiting_token.wlist_id {
            Err(HandlerError::Discrepancy {
                context: "checking slot is part of waiting list",
            })?;
        }
        updates.wtoken_est_turn_time = Some(slot.slot_starts_at);
        Some(slot)
    } else {
        None
    };
    let updated_waiting_token = repo.edit_waiting_token_2(criteria, updates).await?;
    let waiting_list = repo
        .get_waiting_list_by_id(updated_waiting_token.wlist_id)
        .await?;
    Ok(Json((updated_waiting_token, waiting_list, slot).into()))
}

#[derive(serde::Deserialize)]
struct GenerateSlotsParams {
    wlist_secret: String,
}

#[poem::handler]
pub async fn generate_slots_on_waiting_list(
    Path(wlist_secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<GenerateSlotsDto>,
) -> Result<String, HandlerError> {
    let mut n_generated = 0;
    let mut current_date = body.start;
    let waiting_list = repo.get_waiting_list_by_secret(&wlist_secret).await?;
    while n_generated < body.slot_number {
        // TODO: respect breaks
        let end = current_date + Duration::minutes(body.slot_duration_minutes.into());
        repo.create_slot(current_date, end, waiting_list.wlist_id)
            .await?;
        current_date = end;
        n_generated += 1;
    }
    Ok("generated".to_string())
}
