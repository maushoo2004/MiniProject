import { supabase } from "./supabase";

// In development the CRA "proxy" forwards /api/* to the Express server on :3001.
// In production either serve the build from the same server, or set REACT_APP_BACKEND_URL.
const BASE_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

/**
 * Absolute URL of an API path, for plain links the browser opens itself (not fetch calls).
 * In development the React dev server answers page navigations with index.html and only proxies
 * non-HTML requests, so a link must point straight at the API port.
 */
export const apiUrl = (path) =>
  `${BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "")}${path}`;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      "Can't reach the ToxiFilter server. Is it running? (npm run server)",
      0
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const BLOCK_THRESHOLD = Number(process.env.REACT_APP_BLOCK_THRESHOLD || 3);
