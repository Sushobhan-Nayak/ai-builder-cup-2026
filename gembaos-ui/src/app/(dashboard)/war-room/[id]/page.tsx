import { WarRoomView } from "@/components/dashboard/war-room-view";

export default async function WarRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WarRoomView decisionId={id} />;
}
