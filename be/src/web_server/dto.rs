use chrono::prelude::*;
use dotenvy::vars;

#[derive(serde::Serialize, Debug)]
pub struct WaitingListBaseDto {
    pub id: i32,
    pub name: String,
    pub opens_at: Option<DateTime<FixedOffset>>,
    pub closes_at: Option<DateTime<FixedOffset>>,
}

#[derive(serde::Serialize)]
pub struct WaitingListWithRelatedDto {
    #[serde(flatten)]
    pub base: WaitingListBaseDto,
    pub tokens: Vec<WaitingTokenBaseDto>,
    pub slots: Vec<SlotBaseDto>,
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

#[derive(serde::Serialize)]
pub struct ListMasterWithSecretDto {
    pub id: i32,
    pub name: String,
    pub parent_id: Option<i32>,
    pub secret: String,
}

impl From<crate::db::ListMaster> for ListMasterWithSecretDto {
    fn from(src: crate::db::ListMaster) -> Self {
        Self {
            id: src.lm_id,
            name: src.lm_name,
            parent_id: src.lm_parent,
            secret: src.lm_secret,
        }
    }
}

#[derive(serde::Deserialize)]
pub struct CreateListMasterDto {
    pub name: String,
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
    pub list_id: i32,
    pub slot_id: Option<i32>,
}

#[derive(serde::Serialize, Debug, sqlx::FromRow)]
pub struct WaitingTokenWithSecretDto {
    #[serde(flatten)]
    pub base: WaitingTokenBaseDto,
    pub secret: String,
    pub list: WaitingListBaseDto,
    pub slot: Option<SlotBaseDto>,
}

#[derive(serde::Serialize, Debug, sqlx::FromRow)]
pub struct WaitingTokenWithRelatedDto {
    #[serde(flatten)]
    pub base: WaitingTokenBaseDto,
    pub list: WaitingListBaseDto,
    pub slot: Option<SlotBaseDto>,
}

impl From<crate::db::WaitingToken> for WaitingTokenBaseDto {
    fn from(src: crate::db::WaitingToken) -> Self {
        Self {
            id: src.wtoken_id,
            client_name: src.wtoken_client_name,
            generated_at: src.wtoken_generated_at,
            est_turn_time: src.wtoken_est_turn_time,
            real_turn_time: src.wtoken_real_turn_time,
            list_id: src.wlist_id,
            slot_id: src.slot_id,
        }
    }
}

impl From<(crate::db::WaitingToken, crate::db::WaitingList)> for WaitingTokenWithSecretDto {
    fn from(src: (crate::db::WaitingToken, crate::db::WaitingList)) -> Self {
        let secret = src.0.wtoken_secret.clone();
        Self {
            base: std::convert::From::from(src.0),
            secret,
            list: src.1.into(),
            slot: None,
        }
    }
}

impl
    From<(
        crate::db::WaitingToken,
        crate::db::WaitingList,
        Option<crate::db::Slot>,
    )> for WaitingTokenWithSecretDto
{
    fn from(
        src: (
            crate::db::WaitingToken,
            crate::db::WaitingList,
            Option<crate::db::Slot>,
        ),
    ) -> Self {
        let secret = src.0.wtoken_secret.clone();
        Self {
            base: std::convert::From::from(src.0),
            secret,
            list: src.1.into(),
            slot: src.2.map(|x| x.into()),
        }
    }
}

impl
    From<(
        crate::db::WaitingToken,
        crate::db::WaitingList,
        Option<crate::db::Slot>,
    )> for WaitingTokenWithRelatedDto
{
    fn from(
        src: (
            crate::db::WaitingToken,
            crate::db::WaitingList,
            Option<crate::db::Slot>,
        ),
    ) -> Self {
        Self {
            base: std::convert::From::from(src.0),
            list: src.1.into(),
            slot: src.2.map(|slot| slot.into()),
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
    pub start: DateTime<FixedOffset>,
    pub slot_duration_minutes: u32,
    pub break_duration_minutes: u32,
    pub break_every_n_slots: u32,
    pub slot_number: u32,
}

#[derive(serde::Serialize, Debug)]
pub struct SlotBaseDto {
    pub id: i32,
    pub starts_at: DateTime<FixedOffset>,
    pub ends_at: DateTime<FixedOffset>,
    pub list_id: i32,
}

#[derive(serde::Serialize)]
pub struct SlotWithRelatedDto {
    #[serde(flatten)]
    pub base: SlotBaseDto,
    pub list: WaitingListBaseDto,
    pub token: Option<WaitingTokenBaseDto>,
}

impl std::convert::From<crate::db::Slot> for SlotBaseDto {
    fn from(value: crate::db::Slot) -> Self {
        Self {
            id: value.slot_id,
            list_id: value.wlist_id,
            starts_at: value.slot_starts_at,
            ends_at: value.slot_ends_at,
        }
    }
}

impl std::convert::From<crate::db::SlotWithTokenId> for SlotBaseDto {
    fn from(value: crate::db::SlotWithTokenId) -> Self {
        Self {
            id: value.slot_id,
            list_id: value.wlist_id,
            starts_at: value.slot_starts_at,
            ends_at: value.slot_ends_at,
        }
    }
}

impl
    std::convert::From<(
        crate::db::Slot,
        crate::db::WaitingList,
        Option<crate::db::WaitingToken>,
    )> for SlotWithRelatedDto
{
    fn from(
        value: (
            crate::db::Slot,
            crate::db::WaitingList,
            Option<crate::db::WaitingToken>,
        ),
    ) -> Self {
        Self {
            base: value.0.into(),
            list: value.1.into(),
            token: value.2.map(|x| x.into()),
        }
    }
}
