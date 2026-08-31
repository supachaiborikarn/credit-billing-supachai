import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const env = {
    ...process.env,
    NODE_ENV: 'production',
};

const result = spawnSync(process.execPath, [nextBin, 'build'], {
    stdio: 'inherit',
    env,
});

if (result.error) {
    console.error('[build] Failed to start Next.js build:', result.error);
    process.exit(1);
}

process.exit(result.status ?? 1);
