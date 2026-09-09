/**
 * Environment Variable Validator
 * Verifies that required environment variables are set before starting the backend.
 */
function validateEnv() {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET'
  ];

  const missing = [];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error(`\x1b[31m[envValidator] CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(', ')}\x1b[0m`);
    if (process.env.NODE_ENV === 'production') {
      console.error('[envValidator] Server startup blocked in production due to missing configuration keys.');
      process.exit(1);
    }
  }

  // Warn about recommended vars
  const recommended = ['OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'ZAP_URL'];
  for (const envVar of recommended) {
    if (!process.env[envVar]) {
      console.warn(`\x1b[33m[envValidator] WARNING: Recommended variable "${envVar}" is not configured. Some scan capabilities may be disabled.\x1b[0m`);
    }
  }
}

module.exports = { validateEnv };
