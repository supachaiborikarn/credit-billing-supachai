import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [nextBin, 'start', ...args], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: 'production',
    },
});

if (result.error) {
    console.error('[start] Failed to start Next.js production server:', result.error);
    process.exit(1);
}

process.exit(result.status ?? 1);
