use crate::db::WaitingTokenCriteria;

use super::{ArcRepo, HandlerError, dto::*};
use chrono::{Duration, prelude::*};
use poem::web::{Data, Json, Path, Query};

#[poem::handler]
pub async fn index() -> String {
    "Hello".to_owned()
}

#[poem::handler]
pub async fn waiting_list_get(
    Path(id): Path<i32>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<WaitingListWithRelatedDto>, HandlerError> {
    let waiting_list = repo.get_waiting_list_by_id(id).await?;
    let tokens = repo
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
        tokens,
        slots,
    }))
}

#[poem::handler]
pub async fn waiting_list_delete(
    Path(secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
) -> Result<poem::http::StatusCode, HandlerError> {
    repo.delete_waiting_list(secret).await?;
    Ok(poem::http::StatusCode::NO_CONTENT)
}

#[poem::handler]
pub async fn list_master_child_create(
    Path(parent_secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<CreateListMasterDto>,
) -> Result<Json<ListMasterWithSecretDto>, HandlerError> {
    let parent = repo.get_list_master_by_secret(&parent_secret).await?;
    Ok(Json(
        repo.create_list_master(&generate_secret()?, &body.name, Some(parent.lm_id))
            .await?
            .into(),
    ))
}

#[derive(serde::Deserialize)]
struct DeleteListMasterChildParams {
    parent_secret: String,
    child_id: i32,
}

#[poem::handler]
pub async fn list_master_child_delete(
    Path(params): Path<DeleteListMasterChildParams>,
    Data(repo): Data<&ArcRepo>,
) -> Result<poem::http::StatusCode, HandlerError> {
    let parent = repo
        .get_list_master_by_secret(&params.parent_secret)
        .await?;
    let child = repo.get_list_master_by_id(params.child_id).await?;
    if child.lm_parent != Some(parent.lm_id) {
        Err(HandlerError::Discrepancy {
            context: "checking list master parent",
        })?;
    }
    repo.delete_list_master(child.lm_secret).await?;
    Ok(poem::http::StatusCode::NO_CONTENT)
}

#[poem::handler]
pub async fn waiting_token_delete(
    Path(secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
) -> Result<poem::http::StatusCode, HandlerError> {
    repo.delete_waiting_token(secret).await?;
    Ok(poem::http::StatusCode::NO_CONTENT)
}

#[derive(serde::Deserialize)]
struct SlotDeleteParams {
    list_secret: String,
    slot_id: i32,
}

#[poem::handler]
pub async fn slot_delete(
    Path(params): Path<SlotDeleteParams>,
    Data(repo): Data<&ArcRepo>,
) -> Result<poem::http::StatusCode, HandlerError> {
    repo.delete_slot_by_id_and_secret(params.slot_id, params.list_secret)
        .await?;
    Ok(poem::http::StatusCode::NO_CONTENT)
}

#[derive(serde::Deserialize)]
struct GetManyListQuery {
    open: bool,
}

#[derive(serde::Deserialize)]
struct WaitingListCreateQuery {
    master: String,
}

#[poem::handler]
pub async fn waiting_list_get_many(
    Query(query): Query<GetManyListQuery>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<Vec<WaitingListWithRelatedDto>>, HandlerError> {
    let waiting_list = repo.get_all_waiting_list(query.open).await?;
    let mut out = vec![];
    for item in waiting_list {
        let tokens = repo
            .get_waiting_tokens_per_list(item.wlist_id)
            .await?
            .drain(..)
            .map(|item| item.into())
            .collect();
        let slots = repo
            .get_slot_by_list_id(item.wlist_id)
            .await?
            .drain(..)
            .map(|x| x.into())
            .collect();
        out.push(WaitingListWithRelatedDto {
            base: item.into(),
            tokens,
            slots,
        });
    }
    Ok(Json(out))
}

#[poem::handler]
pub async fn waiting_list_create(
    Query(query): Query<WaitingListCreateQuery>,
    Json(input): Json<CreateWaitingListDto>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<WaitingListWithSecretDto>, HandlerError> {
    let list_master = repo.get_list_master_by_secret(&query.master).await?;
    Ok(Json(
        repo.create_waiting_list(
            &generate_secret()?,
            &input.name,
            input.opens_at,
            input.closes_at,
            list_master.lm_id,
        )
        .await?
        .into(),
    ))
}

#[poem::handler]
pub async fn waiting_list_patch(
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
pub async fn waiting_token_create(
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
        let now = Utc::now();
        if slot.slot_starts_at < now {
            Err(HandlerError::Discrepancy {
                context: "slot is in the past",
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

#[poem::handler]
pub async fn waiting_token_get(
    Path(secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<WaitingTokenWithSecretDto>, HandlerError> {
    let token = repo
        .get_waiting_token(crate::db::WaitingTokenCriteria::Secret(secret))
        .await?;
    let waiting_list = repo.get_waiting_list_by_id(token.wlist_id).await?;
    let slot = if let Some(slot_id) = token.slot_id {
        Some(repo.get_slot_by_id(slot_id).await?)
    } else {
        None
    };
    Ok(Json((token, waiting_list, slot).into()))
}

fn generate_secret() -> Result<String, HandlerError> {
    crate::util::generate_secret().map_err(HandlerError::RandomGeneration)
}

#[poem::handler]
pub async fn waiting_token_edit_as_client(
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
    list_secret: String,
    token_id: i32,
}

#[poem::handler]
pub async fn waiting_token_edit_as_admin(
    Path(params): Path<EditWaitingParams>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<EditWaitingTokenDto>,
) -> Result<Json<WaitingTokenWithRelatedDto>, HandlerError> {
    let criteria = crate::db::WaitingTokenCriteria::Id(params.token_id);
    let mut updates: crate::db::EditWaitingToken = body.into();
    let waiting_list = repo.get_waiting_list_by_secret(&params.list_secret).await?;
    let waiting_token = repo.get_waiting_token(criteria.clone()).await?;
    if waiting_list.wlist_id != waiting_token.wlist_id {
        Err(HandlerError::NotFound {
            context: "checking token is part of waiting list",
        })?
    }
    let mut slot = if let Some(slot_id) = updates.slot_id {
        let slot = repo.get_slot_by_id(slot_id).await?;
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
    Ok(Json((updated_waiting_token, waiting_list, slot).into()))
}

// #[derive(serde::Deserialize)]
// struct GenerateSlotsParams {
//     wlist_secret: String,
// }

#[poem::handler]
pub async fn slots_generate_on_waiting_list(
    Path(list_secret): Path<String>,
    Data(repo): Data<&ArcRepo>,
    Json(body): Json<GenerateSlotsDto>,
) -> Result<poem::http::StatusCode, HandlerError> {
    let mut n_generated = 0;
    let mut current_date = body.start;
    let waiting_list = repo.get_waiting_list_by_secret(&list_secret).await?;
    while n_generated < body.slot_number {
        // TODO: make this an iterator so that it can be tested
        if body.break_every_n_slots != 0
            && body.break_duration_minutes != 0
            && n_generated != 0
            && n_generated % body.break_every_n_slots == 0
        {
            current_date += Duration::minutes(body.break_duration_minutes.into());
        }
        let end = current_date + Duration::minutes(body.slot_duration_minutes.into());
        repo.create_slot(current_date, end, waiting_list.wlist_id)
            .await?;
        current_date = end;
        n_generated += 1;
    }
    Ok(poem::http::StatusCode::NO_CONTENT)
}
#[poem::handler]
pub async fn slot_get(
    Path(id): Path<i32>,
    Data(repo): Data<&ArcRepo>,
) -> Result<Json<SlotWithRelatedDto>, HandlerError> {
    let slot = repo.get_slot_by_id_with_wtoken_id(id).await?;
    let list = repo.get_waiting_list_by_id(slot.wlist_id).await?;
    let token = if let Some(wtoken_id) = slot.wtoken_id {
        Some(
            repo.get_waiting_token(WaitingTokenCriteria::Id(wtoken_id))
                .await?,
        )
    } else {
        None
    };
    Ok(Json((slot.into(), list, token).into()))
}
