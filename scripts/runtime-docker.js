import { spawnSync } from 'node:child_process';
import { COMPOSE_PROJECT, dockerDaemonAvailable } from './runtime-bootstrap.js';

const result = dockerDaemonAvailable();
if (!result.ok) {
  console.error(JSON.stringify({ status: 'HOST_DOCKER_UNAVAILABLE', daemon: result }));
  process.exitCode = 1;
} else {
  const command = spawnSync('docker', ['compose', '-p', COMPOSE_PROJECT, ...process.argv.slice(2)], {
    stdio: 'inherit',
    windowsHide: true
  });
  process.exitCode = Number.isInteger(command.status) ? command.status : 1;
}
