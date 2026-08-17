import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

import {createConsoleServer, parseListenAddress, readRuntimeConfiguration, renderRuntimeConfiguration} from './server.mjs';

const valid = {
  VITE_NEKIRO_API_BASE_URL: 'https://gateway.example.test',
  VITE_NEKIRO_PROVIDER_ID: 'provider.main',
  VITE_NEKIRO_PROVIDER_TOKEN: 'provider-token',
  VITE_NEKIRO_OWNER_TOKEN: 'owner-token',
  VITE_NEKIRO_DEFAULT_WORKSPACE_ID: 'workspace.main',
  VITE_NEKIRO_PUBLIC_AGENT_ORIGIN: 'https://agents.example.test',
};

test('runtime configuration fails closed when a required value is absent', () => {
  for (const name of Object.keys(valid)) {
    const candidate = {...valid};
    delete candidate[name];
    assert.throws(() => readRuntimeConfiguration(candidate), new RegExp(name));
  }
});

test('runtime configuration requires exact origins', () => {
  assert.throws(() => readRuntimeConfiguration({...valid, VITE_NEKIRO_API_BASE_URL: 'https://gateway.example.test/v1'}));
  assert.throws(() => readRuntimeConfiguration({...valid, VITE_NEKIRO_PUBLIC_AGENT_ORIGIN: 'https://agents.example.test/'}));
});

test('runtime configuration is rendered without logging or transforming credentials', () => {
  const script = renderRuntimeConfiguration(readRuntimeConfiguration(valid));
  assert.match(script, /^window\.__NEKIRO_CONFIG__ = /);
  assert.match(script, /"VITE_NEKIRO_PROVIDER_TOKEN":"provider-token"/);
});

test('listen address has no inferred default', () => {
  assert.deepEqual(parseListenAddress('0.0.0.0:8080'), {host: '0.0.0.0', port: 8080});
  assert.throws(() => parseListenAddress(undefined));
  assert.throws(() => parseListenAddress('0.0.0.0:0'));
});

test('static server treats an existing directory as an SPA route without crashing', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'nekiro-console-'));
  await writeFile(join(root, 'index.html'), '<h1>NeKiro Console</h1>');
  await mkdir(join(root, 'assets'));
  const server = createConsoleServer({configuration: valid, distDirectory: root});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  });
  const address = server.address();
  assert.equal(typeof address, 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/assets`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<h1>NeKiro Console</h1>');
});
