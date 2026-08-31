import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('S134 release build environment guard', () => {
    it('routes npm build through the portable wrapper', () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };
        expect(pkg.scripts?.build).toBe('node scripts/run-next-build.mjs');
    });

    it('forces production NODE_ENV before starting Next build', () => {
        const source = readFileSync('scripts/run-next-build.mjs', 'utf8');
        expect(source).toContain("NODE_ENV: 'production'");
        expect(source).toContain("require.resolve('next/dist/bin/next')");
        expect(source).toContain("spawnSync(process.execPath, [nextBin, 'build']");
        expect(source).not.toContain('shell: true');
    });
});
