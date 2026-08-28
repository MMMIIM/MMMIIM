import { recreateRuntime } from './runtime-bootstrap.js';

const result = await recreateRuntime();
console.log(JSON.stringify(result));
process.exitCode = result.status === 'READY' ? 0 : 1;
