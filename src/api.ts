import type {
  ApplicationSummary,
  AuthUser,
  JsonSchema,
  ProfileResponse,
  TokenResponse,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
          return loc ? `${loc}: ${String(item.msg)}` : String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }
  return "Request failed.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(
      0,
      "Could not reach the API. Is baked-auth / baked-user running, and is this app proxying to the right ports?",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? (body as { detail: unknown }).detail
        : body;
    throw new ApiError(response.status, formatDetail(detail) || `HTTP ${response.status}`);
  }

  return body as T;
}

function jsonHeaders(token?: string): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function authHeaders(token: string): Headers {
  return new Headers({ Authorization: `Bearer ${token}` });
}

export const api = {
  authHealth: () => request<{ status: string }>("/auth/health"),
  userHealth: () => request<{ status: string }>("/user/health"),

  register: (username: string, password: string) =>
    request<AuthUser>("/auth/v1/auth/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) => {
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    return request<TokenResponse>("/auth/v1/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  },

  me: (token: string) =>
    request<AuthUser>("/auth/v1/users/me", { headers: authHeaders(token) }),

  applications: (token: string) =>
    request<ApplicationSummary[]>("/user/applications", { headers: authHeaders(token) }),

  schema: (appName: string) => request<JsonSchema>(`/user/${appName}/schema`),

  getMyProfile: (appName: string, token: string) =>
    request<ProfileResponse>(`/user/${appName}/users/me`, { headers: authHeaders(token) }),

  createProfile: (appName: string, token: string, profile: Record<string, unknown>) =>
    request<ProfileResponse>(`/user/${appName}/users`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(profile),
    }),

  replaceProfile: (appName: string, token: string, profile: Record<string, unknown>) =>
    request<ProfileResponse>(`/user/${appName}/users/me`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify(profile),
    }),

  deleteProfile: (appName: string, token: string) =>
    request<void>(`/user/${appName}/users/me`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),
};
