import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const markers = [
  ["#/demo", "Three directions. Same data. Pick one."],
  ["#/demo/glass", "6 cards"],
  ["#/demo/terminal", "NEKIRO//OPS"],
  ["#/demo/saas", "Find the right Agent for every workflow"],
];
let ok = true;
for (const [hash, marker] of markers) {
  await page.goto("http://127.0.0.1:3000/" + hash, { waitUntil: "networkidle" });
  try {
    await page.getByText(marker, { exact: true }).waitFor({ timeout: 8000 });
    console.log(`OK   ${hash} -> "${marker}"`);
  } catch {
    ok = false;
    console.log(`FAIL ${hash} -> "${marker}"`);
  }
}
// demos must make zero API calls
const api = [];
page.on("request", (r) => { if (/\/v[34]\//.test(r.url())) api.push(r.url()); });
await page.goto("http://127.0.0.1:3000/#/demo/glass", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log(`demo API calls: ${api.length}`);
await browser.close();
console.log(ok ? "ALL MARKERS OK" : "MARKER FAILURES");