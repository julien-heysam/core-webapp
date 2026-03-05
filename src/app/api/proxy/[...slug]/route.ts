import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FASTAPI_URL = (process.env.FASTAPI_URL || "http://localhost:8000").replace(/\/+$/, "");
const FASTAPI_TOKEN = process.env.FASTAPI_TOKEN || "fake_token_for_local_dev";

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(path, FASTAPI_URL);
  url.search = request.nextUrl.search;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${FASTAPI_TOKEN}`,
  };

  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    fetchOptions.body = await request.text();
  }

  try {
    const res = await fetch(url.toString(), fetchOptions);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `FastAPI proxy error: ${error}` },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
