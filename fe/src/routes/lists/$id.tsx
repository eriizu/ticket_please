import { SingleWaitingList } from "@/components/WaitingList";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lists/$id")({
  beforeLoad: async ({ params }) => {
    const { id } = params;
    const isNumericId = id.trim() !== "" && !Number.isNaN(Number(id));
    let resolvedId = "0";
    if (!isNumericId) {
      try {
        const patate = await fetch(`/api/list/${id}`);
        if (patate.status >= 200 && patate.status < 300) {
          const body = await patate.json();
          resolvedId = `${body.id}`;
        }
      } catch (err) {
        console.error("failed to resolved invite to list id", err);
      }
    }

    if (!isNumericId) {
      throw redirect({
        to: "/lists/$id",
        params: { id: resolvedId },
        search: { invite_code: id },
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>
  <div>Hello "/lists/$id"!</div>
    <SingleWaitingList/>
  </div>;
}
