import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('S136 production start environment guard', () => {
    it('routes npm start through the portable production wrapper', () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };
        expect(pkg.scripts?.start).toBe('node scripts/run-next-start.mjs');
    });

    it('forces production NODE_ENV and forwards runtime CLI arguments', () => {
        const source = readFileSync('scripts/run-next-start.mjs', 'utf8');
        expect(source).toContain("NODE_ENV: 'production'");
        expect(source).toContain("require.resolve('next/dist/bin/next')");
        expect(source).toContain("const args = process.argv.slice(2)");
        expect(source).toContain("[nextBin, 'start', ...args]");
        expect(source).not.toContain('shell: true');
    });
});
