/**
 * Environment validation - fails fast with helpful messages
 */

const REQUIRED_ENV_VARS = [
    'DATABASE_URL',
];

const OPTIONAL_ENV_VARS = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'LOG_LEVEL',
];

interface EnvValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
}

export function validateEnv(): EnvValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const key of REQUIRED_ENV_VARS) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    // Check optional variables (just warn)
    for (const key of OPTIONAL_ENV_VARS) {
        if (!process.env[key]) {
            warnings.push(`Optional env var ${key} is not set`);
        }
    }

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\nPlease add these to your .env.local file');
    }

    if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Optional environment variables not set:');
        warnings.forEach(w => console.warn(`   - ${w}`));
    }

    return {
        valid: missing.length === 0,
        missing,
        warnings,
    };
}

/**
 * Call this at startup to validate environment
 * Will throw if required variables are missing
 */
export function ensureEnv(): void {
    const result = validateEnv();
    if (!result.valid) {
        throw new Error(`Missing required environment variables: ${result.missing.join(', ')}`);
    }
}
