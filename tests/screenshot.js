const { chromium } = require('C:/Users/沈/Desktop/hunyuanji/_tools/x/node-v20.18.0-win-x64/node_modules/playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/沈/Desktop/hunyuanji/_tools/pw/chromium-1134/chrome-win/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto('file:///D:/moshi/wasteland/index.html?auto=1', { waitUntil: 'load' });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: 'D:/moshi/wasteland/production/qa/evidence/pc-02-land.png', fullPage: false });
  console.log('screenshot ok');
  await browser.close();
})();
