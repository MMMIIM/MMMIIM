import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('Compose owns the persistent development runtime services', () => {
  const compose = read('docker-compose.yml');
  for (const service of ['postgres:', 'semantic-gateway:', 'backend:']) {
    assert.match(compose, new RegExp(`^  ${service.replace(':', ':')}\r?$`, 'm'));
  }
  assert.match(compose, /restart:\s*unless-stopped/);
  assert.match(compose, /semantic-gateway:[\s\S]*?"18082:18082"/);
  assert.match(compose, /backend:[\s\S]*?"3001:3001"/);
  assert.match(compose, /postgres:[\s\S]*?"5432:5432"/);
  assert.match(compose, /semantic-gateway:[\s\S]*?healthcheck:/);
  assert.match(compose, /backend:[\s\S]*?healthcheck:/);
  assert.match(compose, /semantic-gateway:[\s\S]*?scripts\/semantic-gateway-watch\.js/);
  assert.match(compose, /backend:[\s\S]*?scripts\/backend-watch\.js/);
  assert.match(compose, /backend:[\s\S]*?condition:\s*service_healthy/);
  assert.match(compose, /semantic-gateway:[\s\S]*?condition:\s*service_healthy/);
  assert.match(compose, /\.\/services\/semantic-gateway\/\.env/);
  assert.match(compose, /\.\/backend\/\.env/);
  assert.match(compose, /SEMANTIC_GATEWAY_API_BASE:\s*http:\/\/semantic-gateway:18082/);
  assert.match(compose, /SEMANTIC_GATEWAY_COMMIT:\s*\$\{SEMANTIC_GATEWAY_COMMIT:-dev-working-tree\}/);
  assert.match(compose, /SEMANTIC_GATEWAY_WORKTREE_DIRTY:\s*\$\{SEMANTIC_GATEWAY_WORKTREE_DIRTY:-true\}/);
  assert.match(compose, /BACKEND_RUNTIME_MODE:\s*container/);
  assert.match(compose, /DATABASE_URL:\s*postgresql:\/\/bid_user:bid_password@postgres:5432\/bid_platform/);
  assert.match(compose, /\.\/backend\/src:\/app\/backend\/src/);
  assert.match(compose, /\.\/services\/semantic-gateway\/src:\/app\/services\/semantic-gateway\/src/);
  assert.match(compose, /\.\/packages\/semantic-contracts:\/app\/packages\/semantic-contracts/);
  assert.match(compose, /\.\/scripts:\/app\/scripts:ro/);
  assert.match(compose, /backend:[\s\S]*?\.\/scripts:\/app\/scripts:ro/);
  assert.doesNotMatch(compose, /node_modules/);
  const watcher = read('scripts/semantic-gateway-watch.js');
  assert.match(watcher, /services\/semantic-gateway\/src/);
  assert.match(watcher, /packages\/semantic-contracts/);
  assert.match(watcher, /spawnImpl/);
  const backendWatcher = read('scripts/backend-watch.js');
  assert.match(backendWatcher, /backend\/src/);
  assert.match(backendWatcher, /backend\/src\/server\.js/);
});

test('runtime scripts keep Docker as the long-lived process owner', () => {
  const packageJson = JSON.parse(read('package.json'));
  const scripts = packageJson.scripts;
  assert.match(scripts['runtime:recreate'], /scripts\/runtime-recreate\.js/);
  assert.match(scripts['runtime:up'], /scripts\/runtime-bootstrap\.js/);
  assert.match(scripts['runtime:refresh'], /scripts\/runtime-bootstrap\.js --refresh/);
  assert.match(scripts['runtime:status'], /scripts\/runtime-docker\.js ps/);
  assert.match(scripts['runtime:logs'], /scripts\/runtime-docker\.js logs/);
  assert.match(scripts['runtime:restart:gateway'], /scripts\/runtime-docker\.js up/);
  assert.match(scripts['runtime:restart:backend'], /scripts\/runtime-docker\.js up/);
  assert.match(scripts['runtime:stop'], /scripts\/runtime-docker\.js stop/);
  assert.match(scripts['dev:full'], /scripts\/dev-full\.js/);
  assert.doesNotMatch(scripts['dev:full'], /semantic-gateway:start|dev -w backend/);
  const recreate = read('scripts/runtime-bootstrap.js');
  const recreateFunction = recreate.match(/export async function recreateRuntime[\s\S]*?\n}\n\n\/\*\*/)?.[0] || '';
  assert.match(recreateFunction, /--no-build/);
  assert.doesNotMatch(recreateFunction, /['"]--build['"]/);
  assert.match(recreateFunction, /semantic-gateway.*backend/s);
  assert.doesNotMatch(recreateFunction, /postgres/);
  const health = read('scripts/runtime-health.js');
  assert.doesNotMatch(health, /docker/i);
  const devFull = read('scripts/dev-full.js');
  assert.doesNotMatch(devFull, /semantic-gateway:start|run', 'dev', '-w', 'backend/);
});

test('development image installs workspace dependencies before copying source', () => {
  const dockerfile = read('Dockerfile.dev');
  assert.match(dockerfile, /^FROM node:\d+-/m);
  assert.match(dockerfile, /npm ci/);
  assert.match(dockerfile, /COPY package\.json package-lock\.json/);
  assert.match(dockerfile, /COPY \. \/app/);
  assert.doesNotMatch(dockerfile, /COPY .*\.env/);
  const dockerignore = read('.dockerignore');
  assert.match(dockerignore, /(^|\r?\n)\.env(\r?\n|$)/);
  assert.match(dockerignore, /(^|\r?\n)\.git(\r?\n|$)/);
});

test('DS Flash and Candidate V3 runtime decision records the accepted live freeze', () => {
  const decision = read('docs/REQUIREMENT_EXTRACTION_RUNTIME_DECISION.md');
  assert.match(decision, /ACTIVE — DS FLASH \+ CANDIDATE V3 LIVE VERIFIED/);
  assert.match(decision, /deepseek-ai\/DeepSeek-V4-Flash/);
  assert.match(decision, /enable_thinking\s*=\s*false/);
  assert.match(decision, /json_schema.*strict\s*=\s*true/s);
  assert.match(decision, /max_tokens\s*=\s*3200/);
  assert.match(decision, /zero retry/);
  assert.match(decision, /zero fallback/);
  assert.match(decision, /Provider HTTP 200: 7\/7/);
  assert.match(decision, /source-range resolution: 7\/7 PASS/);
  assert.match(decision, /total accepted candidates: 51/);
});

test('project instructions route Codex to the persistent runtime boundary', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /Persistent development runtime policy/);
  assert.match(agents, /Docker-owned persistent services/);
  assert.match(agents, /runtime:health/);
  assert.match(agents, /HOST_RUNTIME_REQUIRED/);
  assert.match(agents, /must not spawn foreground Backend\/Gateway replacements/);
});
