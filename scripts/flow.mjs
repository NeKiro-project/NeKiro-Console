// Dev helper: full lifecycle walkthrough of the redesigned Console against
// the local mock gateway, capturing a screenshot at every milestone.
// Usage: node scripts/flow.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.env.CONSOLE_URL ?? 'http://127.0.0.1:3000';
const out = '.design/screens/flow';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const log = (m) => console.log(`[flow] ${m}`);

async function shot(name) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`[flow] saved ${name}.png`);
}

async function responseOf(pred, action) {
  const promise = page.waitForResponse(pred, { timeout: 20000 });
  await action();
  return promise;
}

// --- Registry: load with data
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.getByText('Code Reviewer', { exact: true }).first().waitFor({ timeout: 15000 }).catch(() => log('WARN: no seeded cards visible'));
await shot('01-registry-loaded');

// --- Register a card
await page.getByRole('button', { name: 'Register Agent Card', exact: true }).click();
await shot('02-register-form');
await page.getByLabel('Agent ID', { exact: true }).fill('flow.agent');
await page.getByLabel('Name', { exact: true }).fill('Flow Agent');
await page.getByLabel('Owner ID', { exact: true }).fill('provider.nekiro.dev');
await page.getByLabel('Owner display name', { exact: true }).fill('NeKiro Dev Provider');
await page.getByLabel('Version', { exact: true }).fill('1.0.0');
await page.getByLabel('A2A endpoint', { exact: true }).fill('http://runtime-a:8091');
await page.getByLabel('Authentication', { exact: true }).selectOption('http_bearer');
await page.getByLabel('Permissions, one per line as ID: description', { exact: true }).fill('text.read: Read text payloads');
const regResp = await responseOf((r) => r.url().endsWith('/v3/agents') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Submit draft', exact: true }).click();
});
log(`register -> ${regResp.status()}`);
await page.getByText('Flow Agent', { exact: true }).first().waitFor({ timeout: 10000 });
await shot('03-draft-created');

// --- Select draft and publish
await page.getByText('Flow Agent', { exact: true }).first().click();
await shot('04-draft-inspector');
const pubResp = await responseOf((r) => r.url().includes('/publish') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Publish to Catalog', exact: true }).click();
});
log(`publish -> ${pubResp.status()}`);
await page.getByRole('button', { name: 'Trusted Publication', exact: true }).click();
await page.getByText('Flow Agent', { exact: true }).first().waitFor({ timeout: 10000 });
await shot('05-trusted-before');

// --- Binding -> Challenge -> Release
await page.getByText('Flow Agent', { exact: true }).first().click();
await page.getByLabel('Agent endpoint', { exact: true }).fill('http://runtime-a:8091');
await responseOf((r) => r.url().includes('endpoint-bindings') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Create Binding', exact: true }).click();
});
await page.getByText('pending', { exact: true }).first().waitFor({ timeout: 10000 });
await shot('06-binding-pending');

await responseOf((r) => r.url().includes('/challenges') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Issue Challenge', exact: true }).click();
});
await page.locator('code').last().waitFor({ timeout: 10000 });
await shot('07-challenge-issued');

await responseOf((r) => r.url().includes('/complete') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Complete Verification', exact: true }).click();
});
await page.getByText('verified', { exact: true }).first().waitFor({ timeout: 10000 });
await shot('08-binding-verified');

await responseOf((r) => r.url().includes('/releases') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Create Release', exact: true }).click();
});
const releaseSection = page.locator('section').filter({ hasText: '3. Immutable Release' });
await releaseSection.getByText(/^(pending_verification|verified)$/, { exact: true }).first().waitFor({ timeout: 10000 });
const releaseId = (await releaseSection.getByText('Release', { exact: true }).locator('..').locator('div').nth(1).textContent())?.trim();
log(`releaseId = ${releaseId}`);
await shot('09-release-created');

if ((await releaseSection.getByText(/^(pending_verification|verified)$/, { exact: true }).first().textContent()) === 'pending_verification') {
  await responseOf((r) => r.url().includes('/verify') && r.request().method() === 'POST', async () => {
    await releaseSection.getByRole('button', { name: 'Verify', exact: true }).click();
  });
}
await releaseSection.getByText('verified', { exact: true }).first().waitFor({ timeout: 10000 });
await responseOf((r) => r.url().includes('/publish') && r.request().method() === 'POST', async () => {
  await releaseSection.getByRole('button', { name: 'Publish', exact: true }).click();
});
await releaseSection.getByText('published', { exact: true }).first().waitFor({ timeout: 10000 });
await shot('10-release-published');

// --- Installations: preflight + install
await page.getByRole('button', { name: 'Installations', exact: true }).click();
await page.getByRole('button', { name: 'Refresh', exact: true }).click();
await page.waitForTimeout(800);
const agentSelect = page.getByLabel('Published Agent', { exact: true });
const opt = agentSelect.locator('option[value*="flow.agent"]');
await agentSelect.selectOption((await opt.getAttribute('value')) ?? '');
await page.getByLabel('Trusted Release ID', { exact: true }).fill(releaseId ?? '');
await responseOf((r) => r.url().includes(`/v4/releases/${releaseId}`) && r.request().method() === 'GET', async () => {
  await page.getByRole('button', { name: 'Preflight', exact: true }).click();
});
await page.getByText('Published Release preflight passed', { exact: true }).waitFor({ timeout: 10000 });
await shot('11-preflight-passed');
await page.getByRole('checkbox', { name: /text\.read/ }).check();
await responseOf((r) => r.url().includes('/installations') && r.request().method() === 'POST', async () => {
  await page.getByRole('button', { name: 'Install exact pin', exact: true }).click();
});
await page.getByText('flow.agent', { exact: true }).first().waitFor({ timeout: 10000 });
await shot('12-installation-created');

// --- Invocations: JSON + SSE
await page.getByRole('button', { name: 'Invocations', exact: true }).click();
const installSelect = page.getByLabel('Installed Agent', { exact: true });
const instOpt = installSelect.locator('option', { hasText: 'flow.agent' }).first();
await installSelect.selectOption((await instOpt.getAttribute('value')) ?? '');
await page.getByLabel('Capability', { exact: true }).fill('runtime.echo');
await page.getByLabel('Input JSON', { exact: true }).fill(JSON.stringify({fixture: 'flow', value: {message: 'redesign-walkthrough'}}));
await responseOf((r) => r.url().includes('/invocations') && r.request().method() === 'POST' && (r.request().postData() ?? '').includes('"stream":false'), async () => {
  await page.getByRole('button', { name: 'Invoke', exact: true }).click();
});
await page.locator('pre').filter({ hasText: 'invocationId' }).last().waitFor({ timeout: 15000 });
const result = JSON.parse((await page.locator('pre').filter({ hasText: 'invocationId' }).last().textContent()) ?? '{}');
log(`invocationId = ${result.invocationId}, traceId = ${result.traceId}`);
await shot('13-json-invocation');

await page.getByLabel('Stream result over SSE', { exact: true }).check();
await responseOf((r) => r.url().includes('/invocations') && r.request().method() === 'POST' && (r.request().postData() ?? '').includes('"stream":true'), async () => {
  await page.getByRole('button', { name: 'Invoke', exact: true }).click();
});
await page.getByText('#0 accepted', { exact: true }).waitFor({ timeout: 15000 });
await shot('14-sse-invocation');

// --- Ledger: read trace
await page.getByRole('button', { name: 'Ledger', exact: true }).click();
await page.getByLabel('Trace ID', { exact: true }).fill(String(result.traceId));
await responseOf((r) => r.url().includes('/traces/') && r.request().method() === 'GET', async () => {
  await page.getByRole('button', { name: 'Read', exact: true }).last().click();
});
await page.getByText(String(result.traceId), { exact: false }).last().waitFor({ timeout: 15000 });
await shot('15-ledger-trace');

// --- Public share page (use a seeded public agent id from the mock)
const seeded = await (await fetch('http://127.0.0.1:18080/v3/agents', { headers: { Authorization: 'Bearer dev-owner-token' } })).json();
const shareEntry = seeded.items.find((item) => item.publicAgentId && item.card?.agentId === 'runtime.echo');
if (shareEntry) {
  await page.goto(base + '/a/' + shareEntry.publicAgentId, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot('16-public-agent-page');
  log(`public agent: ${shareEntry.publicAgentId}`);
} else {
  log('WARN: no seeded publicAgentId found');
}

await browser.close();
console.log('[flow] done');
