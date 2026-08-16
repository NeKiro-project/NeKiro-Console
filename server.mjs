import {createReadStream} from 'node:fs';
import {access, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const requiredRuntimeNames = [
  'VITE_NEKIRO_API_BASE_URL',
  'VITE_NEKIRO_PROVIDER_ID',
  'VITE_NEKIRO_PROVIDER_TOKEN',
  'VITE_NEKIRO_OWNER_TOKEN',
  'VITE_NEKIRO_DEFAULT_WORKSPACE_ID',
  'VITE_NEKIRO_PUBLIC_AGENT_ORIGIN',
];

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function requireExactOrigin(name, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an exact HTTP or HTTPS origin`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
    || parsed.origin !== value) {
    throw new Error(`${name} must be an exact HTTP or HTTPS origin`);
  }
}

export function readRuntimeConfiguration(environment) {
  const configuration = {};
  for (const name of requiredRuntimeNames) {
    const value = environment[name];
    if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
      throw new Error(`${name} is required and must not contain surrounding whitespace`);
    }
    configuration[name] = value;
  }
  const providerName = environment.VITE_NEKIRO_PROVIDER_NAME;
  if (providerName !== undefined) {
    if (typeof providerName !== 'string' || providerName.length === 0 || providerName !== providerName.trim()) {
      throw new Error('VITE_NEKIRO_PROVIDER_NAME must be non-empty and must not contain surrounding whitespace');
    }
    configuration.VITE_NEKIRO_PROVIDER_NAME = providerName;
  }
  requireExactOrigin('VITE_NEKIRO_API_BASE_URL', configuration.VITE_NEKIRO_API_BASE_URL);
  requireExactOrigin('VITE_NEKIRO_PUBLIC_AGENT_ORIGIN', configuration.VITE_NEKIRO_PUBLIC_AGENT_ORIGIN);
  return configuration;
}

export function renderRuntimeConfiguration(configuration) {
  const encoded = JSON.stringify(configuration).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `window.__NEKIRO_CONFIG__ = ${encoded};\n`;
}

export function parseListenAddress(value) {
  if (typeof value !== 'string' || value !== value.trim()) {
    throw new Error('NEKIRO_CONSOLE_LISTEN_ADDRESS is required as host:port');
  }
  const match = /^([^:]+):(\d+)$/.exec(value);
  if (!match) throw new Error('NEKIRO_CONSOLE_LISTEN_ADDRESS is required as host:port');
  const port = Number(match[2]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('NEKIRO_CONSOLE_LISTEN_ADDRESS port must be between 1 and 65535');
  }
  return {host: match[1], port};
}

export function createConsoleServer({configuration, distDirectory}) {
  const configScript = renderRuntimeConfiguration(configuration);
  const root = resolve(distDirectory);
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405, {'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD'}).end('method not allowed\n');
      return;
    }
    const pathname = new URL(request.url ?? '/', 'http://console.invalid').pathname;
    if (pathname === '/readyz') {
      response.writeHead(200, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}).end(request.method === 'HEAD' ? undefined : 'ready\n');
      return;
    }
    if (pathname === '/config.js') {
      response.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      }).end(request.method === 'HEAD' ? undefined : configScript);
      return;
    }

    let requested;
    try {
      requested = decodeURIComponent(pathname);
    } catch {
      response.writeHead(400, {'content-type': 'text/plain; charset=utf-8'}).end('bad request\n');
      return;
    }
    const candidate = resolve(root, `.${requested === '/' ? '/index.html' : requested}`);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      response.writeHead(400, {'content-type': 'text/plain; charset=utf-8'}).end('bad request\n');
      return;
    }
    let asset = candidate;
    try {
      await access(asset);
    } catch {
      asset = resolve(root, 'index.html');
    }
    const body = request.method === 'HEAD' ? undefined : createReadStream(asset);
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(asset)) ?? 'application/octet-stream',
      'cache-control': asset.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      'content-security-policy': "default-src 'self'; connect-src 'self' http: https:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
    });
    body?.pipe(response);
    if (!body) response.end();
  });
}

async function main() {
  const configuration = readRuntimeConfiguration(process.env);
  const {host, port} = parseListenAddress(process.env.NEKIRO_CONSOLE_LISTEN_ADDRESS);
  const distDirectory = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
  await readFile(resolve(distDirectory, 'index.html'));
  const server = createConsoleServer({configuration, distDirectory});
  server.listen(port, host, () => process.stdout.write(`NeKiro Console listening on ${host}:${port}\n`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`NeKiro Console failed to start: ${error.message}\n`);
    process.exitCode = 1;
  });
}
