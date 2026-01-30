import { type } from "arktype";
import type { number } from "arktype/internal/keywords/number.ts";

export const SlotBase = type({
  id: "number",
  starts_at: "string.date.parse",
  ends_at: "string.date.parse",
  list_id: "number",
  "registered_client_name?": "string",
  "registered_token_id?": "number",
});

export const WaitingTokenBase = type({
  id: "number",
  client_name: "string | null",
  generated_at: "string.date.parse | null",
  est_turn_time: "string.date.parse | null",
  real_turn_time: "string.date.parse | null",
  list_id: "number",
  slot_id: "number | null",
});

export const WaitingListBase = type({
  closes_at: "string.date.parse | null",
  id: "number",
  name: "string",
  opens_at: "string.date.parse | null",
});

export const WaitingListInvite = type({
   invite_code: "string | null",
});


export const SlotRelated = SlotBase.merge({
  list: WaitingListBase,
  token: WaitingTokenBase.or("null"),
});

export const WaitingTokenWithSecret = WaitingTokenBase.merge({
  secret: "string",
  list: WaitingListBase,
  "slot?": SlotBase.or("null"),
});

export const WaitingListRelated = WaitingListBase.merge({
  slots: SlotBase.array(),
  tokens: WaitingTokenBase.array(),
});

// let patate = {
//   id: 12,
//   starts_at: new Date(),
//   ends_at: new Date(),
//   list_id: 12,
// };

export function matchSlotsToTokens(
  slots: (typeof SlotBase.infer)[],
  tokens: (typeof WaitingTokenBase.infer)[],
) {
  slots.forEach((slot) => {
    const token = tokens.find((token) => token.slot_id === slot.id);
    if (token) {
      slot.registered_client_name = token.client_name || undefined;
      slot.registered_token_id = token.id;
    }
  });
}

export const KnownToken = type({
  id: "number",
  list_id: "number",
  slot_id: "number | null",
  secret: "string",
});

const KnownLists = type("unknown").narrow(
  (value): value is { [id: number]: string } => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    return Object.entries(value).every(
      ([key, val]) => Number.isInteger(Number(key)) && typeof val === "string",
    );
  },
);

export const PersistentStorageSchema = type({
  known_tokens: KnownToken.array(),
  "known_lists?": KnownLists,
  last_used_name: "string | null",
  list_master: "string | null",
});

export class PersistentStorage {
  known_tokens: (typeof KnownToken.infer)[];
  last_used_name: string | null;
  known_lists: {
    [id: number]: string;
  };
  list_master: string | null;

  constructor(
    last_used_name: string | null,
    known_tokens?: (typeof KnownToken.infer)[],
    known_lists?: { [id: number]: string },
    list_master?: string | null,
  ) {
    this.known_tokens = known_tokens || [];
    this.last_used_name = last_used_name;
    this.known_lists = known_lists || {};
    this.list_master = list_master || null;
  }

  // biome-ignore lint/suspicious/noExplicitAny: data is about to be parsed and checked
  static fromRaw(raw: any) {
    const parsed = PersistentStorageSchema(raw);
    if (parsed instanceof type.errors) {
      console.error(parsed.toString());
      return new PersistentStorage(null, [], {}, null);
    }
    return new PersistentStorage(
      parsed.last_used_name,
      parsed.known_tokens,
      parsed.known_lists ?? {},
      parsed.list_master ?? null,
    );
  }

  forList(list_id: number) {
    return this.known_tokens.filter((token) => token.list_id === list_id);
  }

  forToken(id: number) {
    return this.known_tokens.filter((token) => token.id === id);
  }

  forSlot(slot_id: number) {
    return this.known_tokens.filter((token) => token.slot_id === slot_id);
  }

  add(known_token: typeof KnownToken.infer) {
    this.known_tokens.push(known_token);
  }

  async prune() {
    const with_res = await Promise.all(
      this.known_tokens.map(async (token) => {
        return {
          res: await fetch(`/api/token/${token.secret}`),
          token,
        };
      }),
    );
    this.known_tokens = with_res
      .filter(({ res }) => res.status !== 404)
      .map(({ token }) => token);
  }

  removeTokens(tokenIds: number[]) {
    this.known_tokens = this.known_tokens.filter(
      (token) => !tokenIds.includes(token.id),
    );
  }

  removeInvalidTokens(validationResults: Map<number, boolean>) {
    this.known_tokens = this.known_tokens.filter(
      (token) => validationResults.get(token.id) !== false,
    );
  }
}
