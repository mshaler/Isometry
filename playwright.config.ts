import { defineConfig, devices } from '@playwright/test';

/**
 * Isometry v5 — Playwright Visual Testing Configuration
 *
 * Launches Vite dev server, exercises SuperGrid with alto-index datasets.
 * Screenshots saved to e2e/screenshots/ for visual regression tracking.
 */
export default defineConfig({
	testDir: './e2e',
	outputDir: './e2e/test-results',
	fullyParallel: false, // Sequential — each test builds on prior state
	retries: 0,
	workers: 1,
	reporter: [['html', { outputFolder: 'e2e/report', open: 'never' }], ['list']],
	timeout: 60_000,
	expect: {
		timeout: 15_000,
	},
	use: {
		baseURL: 'http://localhost:5173',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		viewport: { width: 1440, height: 900 },
		colorScheme: 'dark',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
			testMatch: ['**/superwidget-smoke.spec.ts', '**/canvas-e2e-gate.spec.ts'],
		},
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
