export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  "https://java-formula-simplifier-service.onrender.com"
).replace(/\/$/, "");

export type SimplifyRequest = {
  normalFunctions: string[];
  recursiveFunctions: string[][];
  expression: string;
};

export type SimplifyResponse = {
  result: string;
};

export type ApiErrorResponse = {
  code?: string;
  message?: string;
  detail?: string;
};

export class ApiClientError extends Error {
  code?: string;
  detail?: string;
  status: number;

  constructor(status: number, error: ApiErrorResponse) {
    super(getApiErrorMessage(error));
    this.name = "ApiClientError";
    this.status = status;
    this.code = error.code;
    this.detail = error.detail;
  }
}

export function getApiErrorMessage(error: ApiErrorResponse | undefined): string {
  return error?.detail || error?.message || "请求失败，请稍后重试";
}

async function readJson<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

export async function simplify(request: SimplifyRequest): Promise<SimplifyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/simplify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await readJson<SimplifyResponse | ApiErrorResponse>(response);

  if (!response.ok) {
    throw new ApiClientError(response.status, (data ?? {}) as ApiErrorResponse);
  }

  return data as SimplifyResponse;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`);
    if (!response.ok) {
      return false;
    }

    const data = await readJson<{ status?: string }>(response);
    return data?.status === "UP";
  } catch {
    return false;
  }
}
