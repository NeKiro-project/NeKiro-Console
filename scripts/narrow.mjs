import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync(".design/screens/narrow", { recursive: true });
const browser = await chromium.launch();
for (const [w, name] of [[768, "768"], [1280, "1280"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `.design/screens/narrow/registry-${name}.png` });
  await page.getByRole("button", { name: "Installations", exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `.design/screens/narrow/installations-${name}.png` });
  await page.close();
}
await browser.close();
console.log("done");