const BACKEND_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const BACKEND_TOKEN = process.env.FASTAPI_TOKEN || "fake_token_for_local_dev";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${BACKEND_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function backendGet(path: string): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, { headers: headers() });
}

export async function backendPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
}
