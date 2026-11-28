import { chromium } from "playwright";
import { one, closeDb } from "./tests/db.mjs";
const owner = await one("SELECT phone FROM User WHERE role='OWNER' AND isActive = true ORDER BY createdAt LIMIT 1");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto("http://localhost:3100/login");
await page.fill("#phone", owner.phone);
await page.fill("#password", process.env.SMOKE_PASSWORD ?? "parol123");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
for (const [name, url] of JSON.parse(process.argv[3])) {
  await page.goto("http://localhost:3100" + url);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${process.argv[2]}/${name}.png` });
}
await b.close();
await closeDb();
