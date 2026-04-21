/**
 * Validates mandatory environment variables on startup
 */
const validateEnv = () => {
    if (!process.env.JWT_SECRET) {
        if ((process.env.NODE_ENV || 'development') !== 'production') {
            process.env.JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';
            console.warn('⚠️ JWT_SECRET was not set. Using an insecure development fallback secret.');
        }
    }

    const required = [
        'DB_HOST',
        'DB_PORT',
        'DB_USER',
        'DB_PASSWORD',
        'DB_NAME',
        'JWT_SECRET',
        'ENGINE_URL'
    ];

    const optional = [
        'FRONTEND_URL',
        'BACKEND_URL',
        'SESSION_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GITHUB_CLIENT_ID',
        'GITHUB_CLIENT_SECRET',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASS',
        'EMAIL_FROM'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing mandatory backend environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('💡 Ensure backend/.env exists and contains all required keys.');
        process.exit(1);
    }

    const missingOptional = optional.filter(key => !process.env[key]);
    if (missingOptional.length > 0) {
        console.warn('⚠️ Optional integrations disabled (missing env vars):');
        missingOptional.forEach(key => console.warn(`   - ${key}`));
    }

    console.log('✅ Environment variables validated');
    console.log(`[config] env=backend/.env node_env=${process.env.NODE_ENV || 'development'}`);
    console.log(`[config] services db=${process.env.DB_HOST}:${process.env.DB_PORT} engine=${process.env.ENGINE_URL}`);
    console.log(`[config] urls frontend=${process.env.FRONTEND_URL || 'http://localhost:3000'} backend=${process.env.BACKEND_URL || 'http://localhost:5000'}`);
};

export default validateEnv;
