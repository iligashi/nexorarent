// Starts the .NET API (https://github.com/iligashi/nexorarent-api) for local
// development with the same database and JWT settings as the Express server.
//
// Run through `npm run dev:dotnet`, which loads server/.env first, so both
// backends always share DB_*, JWT_SECRET and CLIENT_URL.
//
// The API checkout is expected next to this repo (../nexorarent-api).
// Set DOTNET_API_DIR to use another location.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.resolve(process.env.DOTNET_API_DIR || path.join(repoRoot, '..', 'nexorarent-api'));
const project = path.join(apiDir, 'src', 'NexoraRent.Api');
const port = process.env.DOTNET_API_PORT || '5080';

if (!existsSync(project)) {
  console.error(`[dotnet] .NET API not found at ${apiDir}.`);
  console.error('[dotnet] Clone it next to this repo: git clone https://github.com/iligashi/nexorarent-api.git ../nexorarent-api');
  console.error('[dotnet] or set DOTNET_API_DIR to its folder.');
  process.exit(1);
}

if (spawnSync('dotnet', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status !== 0) {
  console.error('[dotnet] The .NET 10 SDK is not installed: https://dotnet.microsoft.com/download');
  process.exit(1);
}

const child = spawn(
  'dotnet',
  ['watch', '--non-interactive', '--project', project, 'run', '--', '--urls', `http://localhost:${port}`],
  {
    cwd: apiDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', NODE_ENV: undefined },
  },
);

const stop = () => child.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
