import { AssetHealthView } from "@/components/dashboard/asset-health-view";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetHealthView assetId={id} />;
}
