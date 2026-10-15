import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_MAPS_KEY = "AIzaSyA3ZGIMrJCh6J1f7ST8B_yqo97Xbnv_cZ8";

export async function GET() {
  // Read dynamically from Cloud Run environment variables, with project fallback
  const key =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    DEFAULT_MAPS_KEY;

  return NextResponse.json({ key });
}
