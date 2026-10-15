import { NextResponse } from "next/server";

export async function GET() {
  // Read dynamically from Cloud Run environment variables at runtime
  const key =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";

  return NextResponse.json({ key });
}
