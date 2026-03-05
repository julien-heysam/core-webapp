const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const FASTAPI_TOKEN = process.env.FASTAPI_TOKEN || "fake_token_for_local_dev";

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function fastapi<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${FASTAPI_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${FASTAPI_TOKEN}`,
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FastAPI ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fastapiStream(
  path: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { params, ...fetchOptions } = options;

  let url = `${FASTAPI_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  return fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${FASTAPI_TOKEN}`,
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });
}

export { FASTAPI_URL };
