import WarRoom from "@/app/(dashboard)/war-room/page";

export default async function WarRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WarRoom paramsDecisionId={id} />;
}
