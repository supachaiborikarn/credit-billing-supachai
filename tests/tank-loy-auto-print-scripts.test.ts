import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Tank Loy Windows auto-print scripts', () => {
    it('installs a daily 07:00 task that starts when Windows becomes available', () => {
        const installer = readFileSync(
            resolve(process.cwd(), 'scripts/install-tank-loy-auto-print.ps1'),
            'utf8'
        );

        expect(installer).toContain("[string]$ScheduleTime = '07:00'");
        expect(installer).toContain('New-ScheduledTaskTrigger -Daily');
        expect(installer).toContain('-StartWhenAvailable');
        expect(installer).toContain("-UserId 'SYSTEM'");

        const launcher = readFileSync(
            resolve(process.cwd(), 'scripts/install-tank-loy-auto-print.cmd'),
            'utf8'
        );
        expect(launcher).toContain('Start-Process');
        expect(launcher).toContain('install-tank-loy-auto-print.ps1');
        expect(launcher).toContain('https://credit-billing-supachai.vercel.app');
        expect(launcher).toContain('192.168.0.218');
        expect(installer).toContain('print-agent-token.txt');
    });

    it('sends a SOAP-wrapped ePOS job and records duplicate-protection state', () => {
        const worker = readFileSync(
            resolve(process.cwd(), 'scripts/tank-loy-auto-print.ps1'),
            'utf8'
        );

        expect(worker).toContain('/cgi-bin/epos/service.cgi');
        expect(worker).toContain('http://schemas.xmlsoap.org/soap/envelope/');
        expect(worker).toContain("status = 'printing'");
        expect(worker).toContain("status = 'printed'");
        expect(worker).toContain("status = 'unknown'");
    });
});
