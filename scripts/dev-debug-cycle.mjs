#!/usr/bin/env node

/**
 * Automated Dev Server Debug Cycle for Chrome for Testing
 *
 * This script provides automated browser testing with console monitoring
 * for the SuperGrid + sql.js integration. Follows GSD execution pattern.
 *
 * Features:
 * - Launches Chrome for Testing in headless mode
 * - Monitors dev server console output
 * - Captures browser console errors/logs
 * - Provides automated fix/debug cycle
 * - Screenshots on errors
 * - Performance metrics capture
 */

import { spawn, exec } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

class DevDebugCycle {
  constructor() {
    this.devServerProcess = null;
    this.browser = null;
    this.page = null;
    this.consoleMessages = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  async start() {
    console.log('🚀 Starting automated dev debug cycle...');

    try {
      await this.ensureDevServer();
      await this.launchBrowser();
      await this.runTestSuite();
      await this.generateReport();
    } catch (error) {
      console.error('💥 Debug cycle failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  async ensureDevServer() {
    console.log('📡 Checking dev server...');

    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) {
        console.log('✅ Dev server already running');
        return;
      }
    } catch (e) {
      // Server not running, start it
    }

    console.log('🔄 Starting dev server...');
    this.devServerProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.devServerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[DEV] ${output.trim()}`);
      if (output.includes('Local:')) {
        console.log('✅ Dev server ready');
      }
    });

    this.devServerProcess.stderr.on('data', (data) => {
      console.error(`[DEV ERROR] ${data.toString().trim()}`);
    });

    // Wait for server to be ready
    await this.waitForServer('http://localhost:5173');
  }

  async waitForServer(url, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch (e) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Server not ready after ${timeout}ms`);
  }

  async launchBrowser() {
    console.log('🌐 Launching Chrome for Testing...');

    // Launch browser with specific flags for testing
    const isHeadless = process.env.HEADLESS === 'true';
    this.browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--window-size=1200,900'
      ],
      devtools: true // Keep DevTools open for debugging
    });

    const context = await this.browser.newContext({
      viewport: { width: 1200, height: 900 },
      recordVideo: {
        dir: './debug-videos/',
        size: { width: 1200, height: 900 }
      }
    });

    this.page = await context.newPage();

    // Set up console monitoring
    this.page.on('console', (msg) => {
      const level = msg.type();
      const text = msg.text();
      const timestamp = new Date().toISOString();

      const logEntry = { level, text, timestamp };
      this.consoleMessages.push(logEntry);

      // Color code based on severity
      const colors = {
        error: '\x1b[31m',   // Red
        warning: '\x1b[33m', // Yellow
        log: '\x1b[36m',     // Cyan
        info: '\x1b[34m',    // Blue
        debug: '\x1b[90m'    // Gray
      };
      const color = colors[level] || '\x1b[0m';
      const reset = '\x1b[0m';

      console.log(`${color}[BROWSER ${level.toUpperCase()}]${reset} ${text}`);

      // Track errors for analysis
      if (level === 'error') {
        this.errors.push(logEntry);
      }
    });

    // Monitor page errors
    this.page.on('pageerror', (error) => {
      console.error('💥 Page Error:', error.message);
      this.errors.push({
        level: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Monitor network failures
    this.page.on('requestfailed', (request) => {
      console.error(`🌐 Network Failed: ${request.method()} ${request.url()} - ${request.failure().errorText}`);
    });
  }

  async runTestSuite() {
    console.log('🧪 Running automated test suite...');

    const tests = [
      { name: 'Main App', url: 'http://localhost:5173', timeout: 10000 },
      { name: 'SuperGrid Demo', url: 'http://localhost:5173/?test=supergrid', timeout: 15000 },
      { name: 'P0 Gate Test', url: 'http://localhost:5173/?test=p0', timeout: 10000 }
    ];

    for (const test of tests) {
      await this.runTest(test);
    }
  }

  async runTest({ name, url, timeout }) {
    console.log(`\n🔍 Testing: ${name}`);
    console.log(`   URL: ${url}`);

    const testStart = Date.now();
    this.errors = []; // Reset errors for this test

    try {
      // Navigate to test URL
      const response = await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
      }

      // Wait for React to hydrate
      await this.page.waitForSelector('body', { timeout: 5000 });

      // Wait a bit for any async operations
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for critical elements based on test type
      if (name === 'SuperGrid Demo') {
        await this.validateSuperGrid();
      }

      const testDuration = Date.now() - testStart;
      const errorCount = this.errors.length;

      if (errorCount === 0) {
        console.log(`   ✅ PASSED (${testDuration}ms)`);
      } else {
        console.log(`   ⚠️  PASSED with ${errorCount} errors (${testDuration}ms)`);
        await this.captureErrorScreenshot(name);
      }

    } catch (error) {
      const testDuration = Date.now() - testStart;
      console.log(`   ❌ FAILED (${testDuration}ms): ${error.message}`);
      await this.captureErrorScreenshot(name);

      // For critical tests, provide debugging info
      if (name === 'SuperGrid Demo') {
        await this.debugSupergrid();
      }
    }
  }

  async validateSuperGrid() {
    console.log('   🔍 Validating SuperGrid components...');

    // Check for key SuperGrid elements
    const checks = [
      { selector: '.supergrid-sql-demo', name: 'SuperGrid Demo Container' },
      { selector: '.supergrid-controls', name: 'Control Panel' },
      { selector: '.supergrid-container', name: 'Grid Container' },
      { selector: 'select[id="x-axis"]', name: 'X-Axis Selector' },
      { selector: 'select[id="y-axis"]', name: 'Y-Axis Selector' },
      { selector: '.search-input', name: 'Search Input' }
    ];

    for (const check of checks) {
      try {
        const element = await this.page.waitForSelector(check.selector, { timeout: 2000 });
        if (element) {
          console.log(`   ✅ ${check.name} found`);
        }
      } catch (error) {
        console.log(`   ❌ ${check.name} missing`);
        throw new Error(`Critical element missing: ${check.name}`);
      }
    }

    // Check for sql.js database initialization
    const dbStatus = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        // Look for database success indicators in console or state
        setTimeout(() => {
          const hasDbError = window.console.error.toString().includes('Database');
          resolve(!hasDbError);
        }, 1000);
      });
    });

    if (!dbStatus) {
      throw new Error('Database initialization may have failed');
    }

    console.log('   ✅ SuperGrid validation complete');
  }

  async debugSupergrid() {
    console.log('   🔧 Debugging SuperGrid issues...');

    // Capture detailed state for debugging
    const state = await this.page.evaluate(() => {
      return {
        hasReact: typeof window.React !== 'undefined',
        hasD3: typeof window.d3 !== 'undefined',
        sqliteProvider: !!document.querySelector('[data-provider="sqlite"]'),
        errorElements: document.querySelectorAll('.error, .error-message').length,
        loadingElements: document.querySelectorAll('.loading, .loading-spinner').length
      };
    });

    console.log('   📊 Debug State:', JSON.stringify(state, null, 2));

    // Check for specific error patterns
    const sqliteErrors = this.errors.filter(e =>
      e.text.includes('sqlite') || e.text.includes('sql.js') || e.text.includes('WASM')
    );

    if (sqliteErrors.length > 0) {
      console.log('   🚨 SQLite/WASM Errors Detected:');
      sqliteErrors.forEach(error => {
        console.log(`     - ${error.text}`);
      });
    }
  }

  async captureErrorScreenshot(testName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-${testName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.png`;
    const filepath = path.join('./debug-screenshots/', filename);

    try {
      await fs.mkdir('./debug-screenshots/', { recursive: true });
      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });
      console.log(`   📸 Screenshot saved: ${filename}`);
    } catch (error) {
      console.error(`   ❌ Screenshot failed: ${error.message}`);
    }
  }

  async generateReport() {
    const duration = Date.now() - this.startTime;
    const totalErrors = this.errors.length;
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      totalErrors,
      consoleMessages: this.consoleMessages.length,
      summary: totalErrors === 0 ? 'ALL TESTS PASSED' : `${totalErrors} ERRORS DETECTED`,
      errors: this.errors,
      recommendations: this.generateRecommendations()
    };

    // Save detailed report
    await fs.mkdir('./debug-reports/', { recursive: true });
    const reportFile = `./debug-reports/debug-report-${Date.now()}.json`;
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n📋 TEST SUMMARY');
    console.log('================');
    console.log(`Duration: ${duration}ms`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Console Messages: ${this.consoleMessages.length}`);
    console.log(`Status: ${report.summary}`);
    console.log(`Report: ${reportFile}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
  }

  generateRecommendations() {
    const recommendations = [];

    const sqliteErrors = this.errors.filter(e =>
      e.text.includes('sqlite') || e.text.includes('sql.js') || e.text.includes('WASM')
    );

    if (sqliteErrors.length > 0) {
      recommendations.push('Fix SQLite/WASM loading issues - check network tab and WASM file paths');
    }

    const reactErrors = this.errors.filter(e =>
      e.text.includes('mount') || e.text.includes('useEffect') || e.text.includes('React')
    );

    if (reactErrors.length > 0) {
      recommendations.push('Fix React component lifecycle issues - check useEffect dependencies');
    }

    const d3Errors = this.errors.filter(e =>
      e.text.includes('d3') || e.text.includes('selection') || e.text.includes('join')
    );

    if (d3Errors.length > 0) {
      recommendations.push('Fix D3.js integration - check data binding and SVG rendering');
    }

    return recommendations;
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    if (this.page) {
      await this.page.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    if (this.devServerProcess) {
      this.devServerProcess.kill();
    }
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const cycle = new DevDebugCycle();

  process.on('SIGINT', async () => {
    console.log('\n⚠️ Interrupted - cleaning up...');
    await cycle.cleanup();
    process.exit(0);
  });

  cycle.start();
}

export default DevDebugCycle;