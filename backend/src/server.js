import validateEnv from './utils/validateEnv.js';

validateEnv();

const PORT = process.env.PORT || 5000;
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // run every 6 hours

const startServer = async () => {
  const { default: app } = await import('./app.js');
  const { default: MaterialService } = await import('./services/material.service.js');

  app.listen(PORT, () => {
    console.log(` Cognify Backend running on port ${PORT}`);
  });

  const runTrashPurge = async () => {
    try {
      await MaterialService.purgeExpiredTrash();
    } catch (err) {
      console.error('[TrashPurge] Scheduled purge failed:', err.message);
    }
  };

  // First run after 30 s (let DB settle), then every 6 h
  setTimeout(runTrashPurge, 30_000);
  setInterval(runTrashPurge, PURGE_INTERVAL_MS);
};

startServer().catch((error) => {
  console.error('❌ Failed to start backend server:', error);
  process.exit(1);
});
