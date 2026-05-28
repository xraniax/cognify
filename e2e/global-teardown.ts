/**
 * global-teardown.ts
 *
 * Runs once after the entire suite finishes.
 * Currently a no-op placeholder — extend this for DB cleanup,
 * deleting ephemeral test users, etc.
 */
export default async function globalTeardown(): Promise<void> {
  // Future: delete ephemeral test accounts created during the run
}
