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
  log(`console.${message.type()}:`, message.text());
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

log('ready:', 'Press Ctrl+C here to close the browser.');
