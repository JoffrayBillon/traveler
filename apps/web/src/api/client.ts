export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly retryAfterSeconds: number | undefined,
    readonly payload: unknown,
  ) {
    super(code ?? `Request failed with status ${status}.`);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiResponse(path, init);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiResponse(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const code =
      payload && typeof payload.error === "string" ? payload.error : undefined;
    const retryAfter = Number.parseInt(
      response.headers.get("Retry-After") ?? "",
      10,
    );

    throw new ApiError(
      response.status,
      code,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      payload,
    );
  }
  return response;
}

export function apiGet<T>(path: string, signal?: AbortSignal) {
  return apiRequest<T>(path, {
    method: "GET",
    ...(signal ? { signal } : {}),
  });
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
