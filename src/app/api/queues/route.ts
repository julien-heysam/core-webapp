import { NextResponse } from "next/server";
import { backendGet } from "@/lib/backend";

export async function GET() {
  try {
    const res = await backendGet("/admin/queues");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: `Backend error: ${error}` }, { status: 502 });
  }
}
