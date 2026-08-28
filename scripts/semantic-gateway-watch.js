import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE_ROOTS = Object.freeze([
  path.resolve('services/semantic-gateway/src'),
  path.resolve('packages/semantic-contracts')
]);

function childIsRunning(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null);
}

function listDirectories(root, readDirectory = fs.readdirSync) {
  const directories = [];
  const visit = directory => {
    directories.push(directory);
    let entries;
    try { entries = readDirectory(directory, { withFileTypes: true }); } catch (_error) { return; }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(path.join(directory, entry.name));
    }
  };
  visit(root);
  return directories;
}

/**
 * Run the Gateway as a Docker-owned child and explicitly watch both the
 * Gateway source and the mounted semantic-contract source. This avoids
 * relying on Node's platform-dependent dependency graph watch behavior.
 */
export function createSemanticGatewayWatcher({
  sourceRoots = DEFAULT_SOURCE_ROOTS,
  spawnImpl = spawn,
  watchImpl = fs.watch,
  readDirectory = fs.readdirSync,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  debounceMs = 80,
  executable = process.execPath,
  entrypoint = 'services/semantic-gateway/src/server.js',
  logger = console
} = {}) {
  let child = null;
  let restartTimer = null;
  let stopping = false;
  const watchers = new Set();

  const startChild = () => {
    if (stopping) return;
    child = spawnImpl(executable, [entrypoint], { stdio: 'inherit' });
    child.once?.('error', error => logger.error?.('Semantic Gateway child failed', error));
  };

  const restartChild = () => {
    if (stopping) return;
    if (!childIsRunning(child)) {
      startChild();
      return;
    }
    const previous = child;
    const onExit = () => {
      previous.removeListener?.('exit', onExit);
      if (!stopping) startChild();
    };
    previous.once?.('exit', onExit);
    previous.kill?.('SIGTERM');
  };

  const scheduleRestart = () => {
    if (stopping) return;
    if (restartTimer !== null) clearTimeoutImpl(restartTimer);
    restartTimer = setTimeoutImpl(() => {
      restartTimer = null;
      restartChild();
    }, debounceMs);
  };

  const watchSourceRoot = root => {
    for (const directory of listDirectories(root, readDirectory)) {
      try {
        const watcher = watchImpl(directory, { persistent: true }, (_eventType, filename) => {
          if (filename) scheduleRestart();
        });
        watchers.add(watcher);
        watcher.on?.('error', error => logger.warn?.('Semantic Gateway watch error', { directory, error: String(error) }));
      } catch (error) {
        logger.warn?.('Semantic Gateway source watch unavailable', { directory, error: String(error) });
      }
    }
  };

  return {
    start() {
      for (const root of sourceRoots) watchSourceRoot(root);
      startChild();
      return { watched_roots: sourceRoots.map(root => path.normalize(root)), watcher_count: watchers.size };
    },
    handleSourceChange: scheduleRestart,
    stop() {
      stopping = true;
      if (restartTimer !== null) clearTimeoutImpl(restartTimer);
      for (const watcher of watchers) watcher.close?.();
      watchers.clear();
      child?.kill?.('SIGTERM');
    },
    get child() { return child; },
    get watcherCount() { return watchers.size; }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const watcher = createSemanticGatewayWatcher();
  watcher.start();
  const stop = () => {
    watcher.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
