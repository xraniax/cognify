/**
 * global-setup.ts
 *
 * Runs once before the entire test suite.
 *
 * Responsibility: log in as each persona (regular user, admin) via the real UI,
 * then persist the resulting browser storage state to disk so every test can
 * reuse it without repeating the login flow.  This makes the suite fast and
 * keeps auth logic in one place.
 *
 * For the regular user we also seed at least one subject via the API so that
 * subject-dependent tests have something to work with on a fresh account.
 */
import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import { STORAGE_STATE } from './playwright.config';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const BASE_URL       = process.env.BASE_URL       ?? 'http://localhost:3000';
// API_URL in .env.test is already the full base: http://localhost:5000/api
const API_URL        = (process.env.API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '');
const USER_EMAIL     = process.env.USER_EMAIL      ?? 'testuser@cognify.com';
const USER_PASSWORD  = process.env.USER_PASSWORD   ?? 'Password123!';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL     ?? 'admin@cognify.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD  ?? 'Admin123!';

/** Read the JWT stored in localStorage after a successful login. */
function readToken(storageStateFile: string): string | null {
  try {
    const state = JSON.parse(fs.readFileSync(storageStateFile, 'utf8'));
    for (const origin of state.origins ?? []) {
      for (const entry of origin.localStorage ?? []) {
        if (entry.name === 'token') return entry.value as string;
      }
    }
  } catch { /* file may not exist on first run */ }
  return null;
}

/** Login via browser UI and persist the storage state. */
async function saveAuthState(email: string, password: string, outFile: string): Promise<void> {
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In Now' }).click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
  await page.context().storageState({ path: outFile });
  await browser.close();

  console.log(`  ✔ Saved auth state for ${email} → ${path.basename(outFile)}`);
}

/** Ensure the user has at least one subject — create one via API if needed. */
async function seedSubjectIfEmpty(storageStateFile: string): Promise<void> {
  const token = readToken(storageStateFile);
  if (!token) {
    console.warn('  ⚠ Could not read token — skipping subject seed');
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Check existing subjects
  const listRes = await fetch(`${API_URL}/subjects`, { headers });
  if (!listRes.ok) {
    console.warn(`  ⚠ GET /api/subjects returned ${listRes.status} — skipping seed`);
    return;
  }
  const body = await listRes.json() as { data?: unknown[]; subjects?: unknown[]; length?: number } | unknown[];
  const subjects: unknown[] = Array.isArray(body)
    ? body
    : (body as { data?: unknown[]; subjects?: unknown[] }).data
      ?? (body as { subjects?: unknown[] }).subjects
      ?? [];

  if (subjects.length > 0) {
    console.log(`  ✔ Subject already exists (${subjects.length} found) — skipping seed`);
    return;
  }

  // Create the seed subject
  const createRes = await fetch(`${API_URL}/subjects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'E2E Seed Subject', description: 'Seeded by Playwright global-setup' }),
  });

  if (createRes.ok) {
    console.log('  ✔ Seeded E2E Seed Subject for test user');
  } else {
    const text = await createRes.text();
    console.warn(`  ⚠ POST /api/subjects returned ${createRes.status}: ${text}`);
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('\n🔐 Playwright global setup — seeding auth storage states…');

  const authDir = path.dirname(STORAGE_STATE.user);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  await saveAuthState(USER_EMAIL,  USER_PASSWORD,  STORAGE_STATE.user);
  await saveAuthState(ADMIN_EMAIL, ADMIN_PASSWORD, STORAGE_STATE.admin);

  // Seed a subject for the regular user so workspace/subjects tests have data
  await seedSubjectIfEmpty(STORAGE_STATE.user);

  console.log('✅ Auth storage states ready\n');
}
