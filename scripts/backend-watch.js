import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSemanticGatewayWatcher } from './semantic-gateway-watch.js';

const watcher = createSemanticGatewayWatcher({
  sourceRoots: [path.resolve('backend/src')],
  entrypoint: 'backend/src/server.js'
});

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  watcher.start();
  const stop = () => {
    watcher.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
