import { chromium } from 'playwright';

async function testSuperGrid() {
  console.log('🧪 Testing SuperGrid functionality...');

  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });
  const page = await browser.newPage();

  // Enable console logs
  page.on('console', msg => {
    console.log('🖥️ Console:', msg.text());
  });

  try {
    console.log('📱 Navigating to application...');
    await page.goto('http://localhost:5179/');
    await page.waitForLoadState('networkidle');

    console.log('📷 Taking initial screenshot...');
    await page.screenshot({ path: '/Users/mshaler/Developer/Projects/Isometry/debug-step1-initial.png' });

    console.log('🎯 Clicking Supergrid button...');
    await page.click('text=Supergrid');

    // Wait a bit for React to render
    await page.waitForTimeout(2000);

    console.log('📷 Taking SuperGrid screenshot...');
    await page.screenshot({ path: '/Users/mshaler/Developer/Projects/Isometry/debug-step2-supergrid.png' });

    // Check for key elements
    const superGridDemo = await page.$('text=SuperGrid Demo');
    const nodesFound = await page.$('text=No nodes found');
    const nodeCount = await page.$('text=Nodes:');

    console.log('🔍 SuperGrid Demo element found:', !!superGridDemo);
    console.log('❌ "No nodes found" element found:', !!nodesFound);
    console.log('📊 Node count element found:', !!nodeCount);

    if (nodeCount) {
      const nodeText = await nodeCount.textContent();
      console.log('📊 Node count text:', nodeText);
    }

    if (nodesFound) {
      const nodesText = await nodesFound.textContent();
      console.log('❌ No nodes text:', nodesText);
    }

    // Run our debug script
    console.log('🔍 Running debug script...');
    await page.addScriptTag({ path: '/Users/mshaler/Developer/Projects/Isometry/debug-supergrid.js' });

    console.log('⏱️ Waiting 5 seconds for manual inspection...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testSuperGrid();