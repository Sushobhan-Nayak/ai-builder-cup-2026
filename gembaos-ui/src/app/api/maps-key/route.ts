import { NextResponse } from "next/server";

const DEFAULT_MAPS_KEY = "AIzaSyA3ZGIMrJCh6J1f7ST8B_yqo97Xbnv_cZ8";

export async function GET(request: Request) {
  const _url = request.url;
  const key =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    DEFAULT_MAPS_KEY;

  return NextResponse.json({ key });
}
