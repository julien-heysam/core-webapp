import Ably from "ably";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel");
  if (!channel) {
    return NextResponse.json({ error: "channel param required" }, { status: 400 });
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ABLY_API_KEY not configured" }, { status: 500 });
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequest = await client.auth.createTokenRequest({
    capability: { [channel]: ["subscribe"] },
    ttl: 3600 * 1000,
  });

  return NextResponse.json(tokenRequest);
}
