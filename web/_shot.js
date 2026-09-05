const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  await page.goto('http://localhost:6789/iframe.html?id=wikilinks-worldwideleaderboard--default&viewMode=story');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-louiemansour-git-wikilinks/2e305025-67ad-4e59-9c21-141eccbd8464/scratchpad/records-desktop.png' });
  await page.setViewportSize({ width: 375, height: 500 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-louiemansour-git-wikilinks/2e305025-67ad-4e59-9c21-141eccbd8464/scratchpad/records-mobile.png' });
  await browser.close();
})();
