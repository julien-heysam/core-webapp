import { NextRequest, NextResponse } from "next/server";
import { backendGet } from "@/lib/backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  try {
    const res = await backendGet(`/admin/deals/${dealId}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: `Backend error: ${error}` }, { status: 502 });
  }
}
