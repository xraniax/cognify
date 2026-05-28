/**
 * api-client.ts
 *
 * Thin wrapper around fetch for hitting the backend API directly from
 * test setup code.  Used for:
 *  - Creating ephemeral test users without going through the UI
 *  - Querying current state to build deterministic assertions
 *
 * This keeps UI tests focused on the UI; boilerplate state setup goes here.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const API_URL = process.env.API_URL ?? 'http://localhost:5000/api';

interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data:   T;
}

interface LoginResponse {
  token: string;
  id:    string;
  email: string;
  name:  string;
  role:  string;
}

// ── Low-level helpers ──────────────────────────────────────────────────────

async function post<T>(
  endpoint: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${endpoint} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

// ── Public helpers ─────────────────────────────────────────────────────────

/** Authenticate via the API and return the JWT token. */
export async function loginViaApi(email: string, password: string): Promise<string> {
  const res = await post<LoginResponse>('/auth/login', { email, password });
  return res.data.token;
}

/**
 * Generate a unique email address for a throwaway test user.
 * Timestamp + random suffix avoids collisions across parallel runs.
 */
export function uniqueEmail(prefix = 'e2e'): string {
  const ts  = Date.now();
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}_${ts}_${rnd}@example.com`;
}

/** Register a new user via the API and return their JWT token. */
export async function registerViaApi(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await post<LoginResponse>('/auth/register', { name, email, password });
  return res.data.token;
}
