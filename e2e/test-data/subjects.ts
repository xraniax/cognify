/**
 * test-data/subjects.ts
 *
 * Test data for Sprint 2: subjects, uploads, trash, and goals.
 * All seeded subject names assume at least one subject exists for USERS.regular
 * in the test database.  The unique* helpers generate throwaway names so
 * create/delete tests do not pollute the shared seeded data.
 */

export const SUBJECTS = {
  /** A subject that must be pre-seeded in the test DB for the regular user. */
  seeded: {
    name: process.env.TEST_SUBJECT_NAME ?? 'Test Subject',
  },

  /** Data for a subject created (and cleaned up) within a test. */
  transient: {
    name:        'E2E Transient Subject',
    description: 'Created and deleted by the automated test suite',
  },
} as const;

export const GOALS = {
  transient: {
    title:       'E2E Study Goal',
    targetHours: '2',
  },
} as const;

/** Returns a subject name that is unique to this test run. */
export function uniqueSubjectName(prefix = 'E2E Subject'): string {
  return `${prefix} ${Date.now()}`;
}

/** Returns a goal title that is unique to this test run. */
export function uniqueGoalTitle(prefix = 'E2E Goal'): string {
  return `${prefix} ${Date.now()}`;
}
