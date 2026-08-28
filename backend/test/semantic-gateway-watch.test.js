import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { createSemanticGatewayWatcher } from '../../scripts/semantic-gateway-watch.js';

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => {
    child.exitCode = 0;
    child.signalCode = 'SIGTERM';
    child.emit('exit', 0, 'SIGTERM');
  };
  return child;
}

test('Gateway watcher watches Gateway and semantic-contract source roots', () => {
  const watched = [];
  const watcher = createSemanticGatewayWatcher({
    sourceRoots: ['/gateway-src', '/semantic-contracts'],
    readDirectory: () => [],
    watchImpl: directory => { watched.push(directory); return { close() {} }; },
    spawnImpl: () => fakeChild(),
    logger: { warn() {}, error() {} }
  });
  const result = watcher.start();
  assert.deepEqual(result.watched_roots, ['/gateway-src', '/semantic-contracts'].map(path.normalize));
  assert.equal(watched.length, 2);
  watcher.stop();
});

test('semantic-contract source change restarts only the Gateway child process', async () => {
  const children = [];
  const timers = [];
  const watcher = createSemanticGatewayWatcher({
    sourceRoots: [],
    spawnImpl: (_executable, args) => {
      const child = fakeChild();
      children.push({ child, args });
      return child;
    },
    setTimeoutImpl: callback => { timers.push(callback); return timers.length; },
    clearTimeoutImpl: () => {},
    logger: { warn() {}, error() {} }
  });
  watcher.start();
  assert.equal(children.length, 1);
  watcher.handleSourceChange();
  timers.shift()();
  assert.equal(children.length, 2);
  assert.deepEqual(children[0].args, ['services/semantic-gateway/src/server.js']);
  assert.deepEqual(children[1].args, ['services/semantic-gateway/src/server.js']);
  watcher.stop();
});
