import net from 'node:net';
import { spawn } from 'node:child_process';
import { assertSafeUatDatabase } from './uat-db-guard.mjs';

export function resolveUatPort(value = process.env.UAT_PORT) {
    const raw = value === undefined || value === '' ? '3005' : String(value);
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('UAT_PORT must be an integer between 1 and 65535');
    }
    if (port === 3000) {
        throw new Error('Port 3000 is reserved by another application and must never be used by CreditBilling');
    }
    return port;
}

function assertPortIsFree(port) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once('error', (error) => {
            reject(new Error(`Port ${port} is already in use or unavailable (${error.code || error.message}). Set UAT_PORT to another free non-3000 port.`));
        });
        server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    });
}

async function main() {
    const safe = assertSafeUatDatabase();
    const port = resolveUatPort();
    await assertPortIsFree(port);

    const env = {
        ...process.env,
        ...safe.config.uatEnv,
        DATABASE_URL: safe.config.uatUrl,
        UAT_DATABASE_URL: safe.config.uatUrl,
        UAT_WRITE_ENABLED: safe.config.confirmation,
        NODE_ENV: 'development',
    };

    console.log(`CreditBilling UAT dev: http://localhost:${port}`);
    console.log(`UAT database host: ${safe.result.summary.uat.host}`);

    const child = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
        stdio: 'inherit',
        env,
    });

    child.on('error', (error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
        if (signal) process.kill(process.pid, signal);
        else process.exit(code ?? 1);
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(2);
    });
}
