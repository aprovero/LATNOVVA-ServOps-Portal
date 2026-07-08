const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    console.log(`[PAGE ERROR STACK] ${error.stack}`);
  });

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'NO ROOT ELEMENT';
  });
  console.log('[ROOT HTML LENGTH]', rootHtml.length);
  if (rootHtml.length < 200) {
    console.log('[ROOT HTML]', rootHtml);
  }
  
  await browser.close();
})();
