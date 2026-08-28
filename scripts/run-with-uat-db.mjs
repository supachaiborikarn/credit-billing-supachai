import { spawnSync } from 'node:child_process';
import { assertSafeUatDatabase } from './uat-db-guard.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
    console.error('Usage: node scripts/run-with-uat-db.mjs <command> [args...]');
    process.exit(2);
}

let safe;
try {
    safe = assertSafeUatDatabase();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
}

const childEnv = {
    ...process.env,
    ...safe.config.uatEnv,
    DATABASE_URL: safe.config.uatUrl,
    UAT_DATABASE_URL: safe.config.uatUrl,
    UAT_WRITE_ENABLED: safe.config.confirmation,
};

console.log(`Running against UAT host: ${safe.result.summary.uat.host}`);
const child = spawnSync(command, args, {
    stdio: 'inherit',
    env: childEnv,
});

if (child.error) {
    console.error(child.error.message);
    process.exit(1);
}
process.exit(child.status ?? 1);
