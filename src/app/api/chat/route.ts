import { NextRequest, NextResponse } from "next/server";
import { backendPost } from "@/lib/backend";

export const dynamic = "force-dynamic";

const BACKEND_URL = (process.env.FASTAPI_URL || "http://localhost:8000").replace(/\/+$/, "");
const BACKEND_TOKEN = process.env.FASTAPI_TOKEN || "fake_token_for_local_dev";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.stream) {
      const res = await fetch(`${BACKEND_URL}/admin/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: "Stream failed" }));
        return NextResponse.json(errData, { status: res.status });
      }

      return new Response(res.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const res = await backendPost("/admin/chat", body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: `Backend error: ${error}` },
      { status: 502 }
    );
  }
}
