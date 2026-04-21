import validateEnv from './utils/validateEnv.js';

validateEnv();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const { default: app } = await import('./app.js');

  app.listen(PORT, () => {
    console.log(` Cognify Backend running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('❌ Failed to start backend server:', error);
  process.exit(1);
});
