/**
 * test-data/users.ts
 *
 * Central source of truth for user credentials used across tests.
 * Values default to the seeded accounts in .env.test; override via
 * environment variables for staging/production runs.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

export const USERS = {
  /** Pre-seeded regular (student) user that must exist in the test DB. */
  regular: {
    email:    process.env.USER_EMAIL    ?? 'testuser@cognify.com',
    password: process.env.USER_PASSWORD ?? 'Password123!',
    name:     process.env.USER_NAME     ?? 'Test User',
  },

  /** Pre-seeded admin user that must exist in the test DB. */
  admin: {
    email:    process.env.ADMIN_EMAIL    ?? 'admin@cognify.com',
    password: process.env.ADMIN_PASSWORD ?? 'Admin123!',
    name:     'Admin',
  },

  /** Invalid credential pairs — used to test error states. */
  invalid: {
    wrongPassword:    { email: process.env.USER_EMAIL ?? 'testuser@cognify.com', password: 'WrongPass999!' },
    nonExistentEmail: { email: 'nobody@nowhere.invalid', password: 'Password123!' },
    malformedEmail:   { email: 'not-an-email',           password: 'Password123!' },
  },

  /** Weak passwords — used to test registration validation. */
  weakPasswords: ['abc', '1234567', 'short'],
} as const;

export const REGISTRATION = {
  validPassword:  'SecurePass123!',
  weakPassword:   'abc',
  shortPassword:  '1234567',
} as const;
