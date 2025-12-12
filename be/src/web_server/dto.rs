use chrono::prelude::*;

#[derive(serde::Serialize)]
pub struct WaitingListBaseDto {
    pub id: i32,
    pub name: String,
    pub opens_at: Option<DateTime<FixedOffset>>,
    pub closes_at: Option<DateTime<FixedOffset>>,
}

#[derive(serde::Serialize)]
pub struct WaitingListWithWaitingTokensDto {
    #[serde(flatten)]
    pub base: WaitingListBaseDto,
    pub waiting_tokens: Vec<WaitingTokenBaseDto>,
}

#[derive(serde::Serialize)]
pub struct WaitingListWithSecretDto {
    #[serde(flatten)]
    pub base: WaitingListBaseDto,
    pub secret: String,
}

impl From<crate::db::WaitingList> for WaitingListBaseDto {
    fn from(w: crate::db::WaitingList) -> Self {
        WaitingListBaseDto {
            id: w.wlist_id,
            name: w.wlist_name,
            opens_at: w.wlist_opens_at,
            closes_at: w.wlist_closes_at,
        }
    }
}

impl From<crate::db::WaitingList> for WaitingListWithSecretDto {
    fn from(w: crate::db::WaitingList) -> Self {
        WaitingListWithSecretDto {
            base: WaitingListBaseDto {
                id: w.wlist_id,
                name: w.wlist_name,
                opens_at: w.wlist_opens_at,
                closes_at: w.wlist_closes_at,
            },
            secret: w.wlist_secret,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct CreateWaitingListDto {
    pub name: String,
    pub opens_at: Option<DateTime<FixedOffset>>,
    pub closes_at: Option<DateTime<FixedOffset>>,
}

#[derive(serde::Deserialize)]
pub struct PatchWaitingListDto {
    pub name: Option<String>,
    pub opens_at: Option<DateTime<FixedOffset>>,
    pub closes_at: Option<DateTime<FixedOffset>>,
}

impl std::convert::From<PatchWaitingListDto> for crate::db::PartialWaitingList {
    fn from(val: PatchWaitingListDto) -> Self {
        crate::db::PartialWaitingList {
            wlist_name: val.name,
            wlist_opens_at: val.opens_at,
            wlist_closes_at: val.closes_at,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct WaitingTokenBaseDto {
    pub id: i32,
    pub client_name: Option<String>,
    pub generated_at: DateTime<FixedOffset>,
    pub est_turn_time: Option<DateTime<FixedOffset>>,
    pub real_turn_time: Option<DateTime<FixedOffset>>,
    pub waiting_list_id: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, sqlx::FromRow)]
pub struct WaitingTokenWithSecretDto {
    #[serde(flatten)]
    pub base: WaitingTokenBaseDto,
    pub secret: String,
}

impl From<crate::db::WaitingToken> for WaitingTokenBaseDto {
    fn from(src: crate::db::WaitingToken) -> Self {
        Self {
            id: src.wtoken_id,
            client_name: src.wtoken_client_name,
            generated_at: src.wtoken_generated_at,
            est_turn_time: src.wtoken_est_turn_time,
            real_turn_time: src.wtoken_real_turn_time,
            waiting_list_id: src.wlist_id,
        }
    }
}

impl From<crate::db::WaitingToken> for WaitingTokenWithSecretDto {
    fn from(src: crate::db::WaitingToken) -> Self {
        let secret = src.wtoken_secret.clone();
        Self {
            base: std::convert::From::from(src),
            secret,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct AskWaitingTokenDto {
    pub client_name: Option<String>,
    pub slot_id: Option<i32>,
}

impl std::convert::Into<crate::db::EditWaitingToken> for AskWaitingTokenDto {
    fn into(self) -> crate::db::EditWaitingToken {
        crate::db::EditWaitingToken {
            wtoken_client_name: self.client_name,
            wtoken_est_turn_time: None,
            wtoken_real_turn_time: None,
            slot_id: self.slot_id,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct EditWaitingTokenDto {
    pub est_turn_time: Option<DateTime<FixedOffset>>,
    pub real_turn_time: Option<DateTime<FixedOffset>>,
    pub slot_id: Option<i32>,
}

impl std::convert::Into<crate::db::EditWaitingToken> for EditWaitingTokenDto {
    fn into(self) -> crate::db::EditWaitingToken {
        crate::db::EditWaitingToken {
            wtoken_client_name: None,
            wtoken_est_turn_time: self.est_turn_time,
            wtoken_real_turn_time: self.real_turn_time,
            slot_id: self.slot_id,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct GenerateSlotsDto {
    start: DateTime<FixedOffset>,
    slot_duration_minutes: u32,
    break_duration_minutes: u32,
    break_every_n_slots: u32,
    slot_number: u32,
}
