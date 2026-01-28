import { chromium } from 'playwright';

const url = process.env.VITE_DEV_URL || 'http://localhost:5173/';

function log(prefix, message) {
  const time = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${time}] ${prefix} ${message}`);
}

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

page.on('console', message => {
  const location = message.location();
  const locationInfo = location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : '';
  log(`console.${message.type()}:`, `${message.text()}${locationInfo}`);
});

page.on('pageerror', error => {
  log('pageerror:', error.stack || error.message);
});

page.on('requestfailed', request => {
  const failure = request.failure();
  log('requestfailed:', `${request.method()} ${request.url()} ${failure?.errorText || 'unknown error'}`);
});

page.on('response', response => {
  if (response.status() >= 400) {
    log('response:', `${response.status()} ${response.url()}`);
  }
});

log('open:', url);
await page.goto(url, { waitUntil: 'domcontentloaded' });

const readDomText = async (label) => {
  const text = await page.evaluate(() => document.body?.innerText || '');
  log(label, text.trim().slice(0, 200) || '(empty)');
};

await readDomText('dom');
await page.waitForTimeout(3000);
await readDomText('dom+3s');

const autoNotebook = process.env.WATCH_NOTEBOOK !== '0';
if (autoNotebook) {
  const notebookButton = page.getByRole('button', { name: 'Notebook' });
  try {
    await notebookButton.first().waitFor({ timeout: 5000 });
    await notebookButton.first().click();
    log('action:', 'Clicked Notebook button');
    await page.waitForTimeout(1000);
    await readDomText('dom+notebook');
  } catch {
    const buttonTexts = await page.locator('button').allTextContents();
    log('action:', `Notebook button not found (after wait). Buttons: ${buttonTexts.join(' | ') || 'none'}`);
  }
}

log('ready:', 'Press Ctrl+C here to close the browser.');
