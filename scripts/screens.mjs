// Dev helper: capture baseline screenshots of the NeKiro Console.
// Usage: node scripts/screens.mjs <outDir> [width]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const outDir = process.argv[2] ?? '.design/screens';
const width = Number(process.argv[3] ?? 1440);
const height = 900;
const base = process.env.CONSOLE_URL ?? 'http://127.0.0.1:3000';

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });

async function shot(name, url = '/') {
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`saved ${outDir}/${name}.png`);
}

await shot('00-root');
for (const tab of ['Registry', 'Trusted Publication', 'Installations', 'Invocations', 'Ledger']) {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: tab, exact: true }).click().catch((e) => console.log(`tab ${tab} failed: ${e.message.split('\n')[0]}`));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/tab-${tab.toLowerCase().replace(/\s+/g, '-')}.png` });
  console.log(`saved tab ${tab}`);
}
await shot('demo-launcher', '/#/demo');
await shot('demo-glass', '/#/demo/glass');
await shot('demo-terminal', '/#/demo/terminal');
await shot('demo-saas', '/#/demo/saas');
await shot('public-agent', '/a/agt_nonexistent');

await browser.close();
console.log('done');
