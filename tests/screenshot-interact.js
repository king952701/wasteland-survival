const { chromium } = require('C:/Users/沈/Desktop/hunyuanji/_tools/x/node-v20.18.0-win-x64/node_modules/playwright-core');
const fs = require('fs');
const dir = 'D:/moshi/wasteland/production/qa/evidence';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/沈/Desktop/hunyuanji/_tools/pw/chromium-1134/chrome-win/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto('file:///D:/moshi/wasteland/index.html?auto=1', { waitUntil: 'load' });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: dir + '/pc-03-stand.png' });
  await page.keyboard.press('e');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: dir + '/pc-04-search.png' });
  await page.keyboard.press('c');
  await page.waitForTimeout(500);
  await page.screenshot({ path: dir + '/pc-05-craft.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('i');
  await page.waitForTimeout(500);
  await page.screenshot({ path: dir + '/pc-06-inv.png' });
  await page.keyboard.press('Escape');
  await browser.close();
})();
