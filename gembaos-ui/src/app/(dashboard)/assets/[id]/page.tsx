import AssetHealth from "@/app/(dashboard)/asset-health/page";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetHealth paramsAssetId={id} />;
}
