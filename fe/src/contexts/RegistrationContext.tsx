import type * as models from "../models";

type KnownToken = typeof models.KnownToken.infer;

export type Registration = {
  list_id: number;
  slot_id?: number;
  invite?: string;
};
