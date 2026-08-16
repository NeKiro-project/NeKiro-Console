// Probe accessible names of all e2e-critical labels across the app.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const checks = [
  ['/', 'Agent Card Catalog', 'heading'],
  ['/', 'API: configured', 'text'],
  ['/', 'Register Agent Card', 'button'],
];

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Registry labels
await page.getByRole('button', { name: 'Register Agent Card', exact: true }).click();
await page.waitForTimeout(300);
for (const name of ['Agent ID', 'Name', 'Owner ID', 'Owner display name', 'Version', 'A2A endpoint', 'Authentication', 'Permissions, one per line as ID: description', 'Capabilities JSON', 'Description']) {
  console.log(`[registry] "${name}" exact:`, await page.getByLabel(name, { exact: true }).count());
}
await page.getByRole('button', { name: 'Cancel', exact: true }).click();

// Installations labels
await page.getByRole('button', { name: 'Installations', exact: true }).click();
await page.waitForTimeout(800);
for (const name of ['Published Agent', 'Trusted Release ID', 'Exact version constraint', 'Public Agent URL', 'Exact public Release']) {
  console.log(`[installations] "${name}" exact:`, await page.getByLabel(name, { exact: true }).count());
}

// Invocations labels
await page.getByRole('button', { name: 'Invocations', exact: true }).click();
await page.waitForTimeout(500);
for (const name of ['Installed Agent', 'Capability', 'Input JSON', 'Stream result over SSE']) {
  console.log(`[invocations] "${name}" exact:`, await page.getByLabel(name, { exact: true }).count());
}

// Ledger labels
await page.getByRole('button', { name: 'Ledger', exact: true }).click();
await page.waitForTimeout(500);
for (const name of ['Invocation ID', 'Trace ID']) {
  console.log(`[ledger] "${name}" exact:`, await page.getByLabel(name, { exact: true }).count());
}

// Public page
await page.goto('http://127.0.0.1:3000/a/agt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log(`[public] "Review a shared Agent" heading:`, await page.getByRole('heading', { name: 'Review a shared Agent' }).count());
console.log(`[public] "Exact public Release" exact:`, await page.getByLabel('Exact public Release', { exact: true }).count());

await browser.close();
console.log('probe done');
