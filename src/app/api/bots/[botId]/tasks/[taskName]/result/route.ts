import { NextRequest, NextResponse } from "next/server";
import { backendGet } from "@/lib/backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ botId: string; taskName: string }> }
) {
  const { botId, taskName } = await params;
  try {
    const res = await backendGet(`/admin/bots/${botId}/tasks/${taskName}/result`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: `Backend error: ${error}` }, { status: 502 });
  }
}
