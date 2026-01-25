import { createFileRoute, redirect } from "@tanstack/react-router";
import { SingleWaitingList } from "@/components/WaitingList";
import { useWaitingList } from "@/hooks/useWaitingLists";

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
  const { id } = Route.useParams();
  const { data: list, isLoading, isError } = useWaitingList(id);

  if (isLoading) {
    return <div>Loading</div>;
  }
  if (isError) {
    return <div>Error</div>;
  }

  if (list) {
    return (
      <div>
        <div>Hello "/lists/$id"!</div>
        <SingleWaitingList list={list} listManagmentSecret={null} />
      </div>
    );
  }
}
