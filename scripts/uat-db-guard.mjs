import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const UAT_WRITE_CONFIRMATION = 'YES_I_KNOW_THIS_IS_UAT';

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function parsePostgresUrl(value, label) {
    if (!value) return { error: `${label} is missing` };
    try {
        const url = new URL(value);
        if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
            return { error: `${label} must be a PostgreSQL URL` };
        }
        return { url };
    } catch {
        return { error: `${label} is not a valid URL` };
    }
}

function databaseName(url) {
    return url.pathname.replace(/^\//, '') || '(default)';
}

export function resolveUatDatabaseConfig({ cwd = process.cwd(), env = process.env } = {}) {
    const localEnv = readEnvFile(path.join(cwd, '.env.local'));
    const uatEnv = readEnvFile(path.join(cwd, '.env.uat.local'));

    return {
        productionUrl: env.PRODUCTION_DATABASE_URL || localEnv.DATABASE_URL || env.DATABASE_URL || '',
        uatUrl: env.UAT_DATABASE_URL || uatEnv.UAT_DATABASE_URL || '',
        confirmation: env.UAT_WRITE_ENABLED || uatEnv.UAT_WRITE_ENABLED || '',
        uatEnv,
    };
}

export function validateUatDatabaseConfig(config) {
    const errors = [];
    const prod = parsePostgresUrl(config.productionUrl, 'Production DATABASE_URL');
    const uat = parsePostgresUrl(config.uatUrl, 'UAT_DATABASE_URL');

    if (prod.error) errors.push(prod.error);
    if (uat.error) errors.push(uat.error);
    if (config.confirmation !== UAT_WRITE_CONFIRMATION) {
        errors.push(`UAT_WRITE_ENABLED must equal ${UAT_WRITE_CONFIRMATION}`);
    }

    if (prod.url && uat.url) {
        if (prod.url.href === uat.url.href) {
            errors.push('UAT_DATABASE_URL must not be identical to production DATABASE_URL');
        }
        if (prod.url.hostname === uat.url.hostname) {
            errors.push('UAT_DATABASE_URL must use a different database host/branch from production');
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        summary: {
            production: prod.url ? { host: prod.url.hostname, database: databaseName(prod.url) } : null,
            uat: uat.url ? { host: uat.url.hostname, database: databaseName(uat.url) } : null,
        },
    };
}

export function assertSafeUatDatabase(options = {}) {
    const config = resolveUatDatabaseConfig(options);
    const result = validateUatDatabaseConfig(config);
    if (!result.ok) {
        const error = new Error(`Unsafe UAT database configuration:\n- ${result.errors.join('\n- ')}`);
        error.code = 'UAT_DB_UNSAFE';
        throw error;
    }
    return { config, result };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    try {
        const { result } = assertSafeUatDatabase();
        console.log('UAT database preflight: PASS');
        console.log(`production host: ${result.summary.production.host}`);
        console.log(`uat host: ${result.summary.uat.host}`);
        console.log(`uat database: ${result.summary.uat.database}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(2);
    }
}
