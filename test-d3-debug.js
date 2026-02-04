import { chromium } from 'playwright';

async function debugD3Layer() {
  console.log('🔍 Debugging D3SparsityLayer...');

  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });
  const page = await browser.newPage();

  // Enable console logs
  page.on('console', msg => {
    console.log('📟', msg.text());
  });

  try {
    console.log('📱 Navigating to application...');
    await page.goto('http://localhost:5179/');
    await page.waitForLoadState('networkidle');

    console.log('🎯 Clicking Supergrid button...');
    await page.click('text=Supergrid');
    await page.waitForTimeout(3000);

    console.log('📷 Taking debug screenshot...');
    await page.screenshot({ path: '/Users/mshaler/Developer/Projects/Isometry/debug-d3-layer.png' });

    console.log('⏱️ Waiting 3 seconds for console logs...');
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugD3Layer();