import { chromium } from 'playwright';

async function takeCleanSupergridScreenshot() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5179/');
    await page.waitForLoadState('networkidle');

    // Click Supergrid button
    await page.click('text=Supergrid');
    await page.waitForTimeout(2000);

    // Take final screenshot
    await page.screenshot({
      path: '/Users/mshaler/Developer/Projects/Isometry/supergrid-final-clean.png',
      fullPage: true
    });

    console.log('✅ Final screenshot saved: supergrid-final-clean.png');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

takeCleanSupergridScreenshot();