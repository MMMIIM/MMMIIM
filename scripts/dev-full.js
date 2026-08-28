import { spawn } from 'node:child_process';
import { runtimeHealth } from './runtime-health.js';

const health = await runtimeHealth();
if (health.runtime !== 'READY') {
  console.error('HOST_RUNTIME_REQUIRED: Run `npm run runtime:bootstrap` once from a normal host PowerShell.');
  process.exitCode = 1;
} else {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'dev', '-w', 'frontend'], { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
