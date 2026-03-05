const BACKEND_URL = (process.env.FASTAPI_URL || "http://localhost:8000").replace(/\/+$/, "").trim();
const BACKEND_TOKEN = (process.env.FASTAPI_TOKEN || "fake_token_for_local_dev").trim();

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${BACKEND_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function buildUrl(path: string): string {
  const base = BACKEND_URL.replace(/\/+$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}

export async function backendGet(path: string): Promise<Response> {
  const url = buildUrl(path);
  console.log(`[backend] GET ${url}`);
  return fetch(url, { headers: headers(), cache: "no-store" });
}

export async function backendPost(path: string, body: unknown): Promise<Response> {
  const url = buildUrl(path);
  console.log(`[backend] POST ${url}`);
  return fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
}
