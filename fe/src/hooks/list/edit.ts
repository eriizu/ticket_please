import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type } from "arktype";
import * as models from "@/models";

export type WaitingListField = "opens_at" | "closes_at";

interface EditListArgs {
  name?: string;
  opens_at?: Date | null;
  closes_at?: Date | null;
  clear_fields?: WaitingListField[];
}

export function useEditList(secret: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: EditListArgs) => {
      const res = await fetch(`/api/list/${secret}`, {
        method: "PATCH",
        body: JSON.stringify(args),
        headers: { "Content-Type": "application/json" },
      });
      if (res.status < 200 || res.status > 299) {
        throw new Error("request failed", { cause: await res.text() });
      }
      const parsedBody = models.WaitingListBase(await res.json());
      if (parsedBody instanceof type.errors) {
        console.error(parsedBody);
        throw new Error(`body parsing error: ${parsedBody.toString()}`, {
          cause: parsedBody,
        });
      }
      return parsedBody;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list"] });
    },
    onError: (e) => {
      console.error("edit list failed", e);
    },
  });
}
