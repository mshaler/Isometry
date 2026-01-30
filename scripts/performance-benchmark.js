#!/usr/bin/env node

/**
 * Performance Benchmark Script for D3 Visualizations
 *
 * Automated stress testing and performance measurement for Isometry Canvas
 * visualizations with varying dataset sizes and rendering modes.
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Benchmark configuration
const BENCHMARK_CONFIG = {
  // Test data sizes
  dataSizes: [100, 500, 1000, 2500, 5000, 6891], // Include real Apple Notes size

  // Visualization types to test
  viewTypes: ['grid', 'list', 'network'],

  // Performance modes
  performanceModes: ['high', 'medium', 'low'],

  // Test duration per scenario (ms)
  testDuration: 10000,

  // Performance thresholds
  thresholds: {
    minFps: 45,
    maxRenderTime: 25, // ms
    maxMemoryMB: 150,
    minPerformanceScore: 60
  },

  // Browser config
  browser: {
    headless: true,
    width: 1920,
    height: 1080
  }
};

// Performance metrics collector
class PerformanceCollector {
  constructor() {
    this.metrics = [];
  }

  async startCollection(page) {
    // Enable performance monitoring in browser
    await page.evaluateOnNewDocument(() => {
      window.performanceMetrics = {
        fps: [],
        renderTimes: [],
        memoryUsage: [],
        scores: [],
        startTime: performance.now()
      };

      // FPS measurement
      let lastFrameTime = performance.now();
      let frameCount = 0;

      function measureFPS() {
        const now = performance.now();
        const delta = now - lastFrameTime;

        if (delta >= 1000) {
          const fps = frameCount / (delta / 1000);
          window.performanceMetrics.fps.push(fps);
          frameCount = 0;
          lastFrameTime = now;
        }

        frameCount++;
        requestAnimationFrame(measureFPS);
      }

      requestAnimationFrame(measureFPS);

      // Memory monitoring
      setInterval(() => {
        if (performance.memory) {
          window.performanceMetrics.memoryUsage.push({
            timestamp: performance.now(),
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize
          });
        }
      }, 1000);

      // Listen for performance updates from Canvas
      window.addEventListener('isometry-performance-update', (event) => {
        const { metrics } = event.detail;
        window.performanceMetrics.scores.push({
          timestamp: performance.now(),
          score: metrics.performanceScore,
          renderTime: metrics.renderTime,
          fps: metrics.fps
        });
      });
    });
  }

  async collectMetrics(page) {
    return await page.evaluate(() => {
      const metrics = window.performanceMetrics;

      if (!metrics || !metrics.fps.length) {
        return null;
      }

      // Calculate averages
      const avgFPS = metrics.fps.reduce((sum, fps) => sum + fps, 0) / metrics.fps.length;
      const avgRenderTime = metrics.scores.length > 0
        ? metrics.scores.reduce((sum, score) => sum + score.renderTime, 0) / metrics.scores.length
        : 0;
      const avgScore = metrics.scores.length > 0
        ? metrics.scores.reduce((sum, score) => sum + score.score, 0) / metrics.scores.length
        : 0;

      // Memory statistics
      const memoryStats = metrics.memoryUsage.length > 0 ? {
        peak: Math.max(...metrics.memoryUsage.map(m => m.used)),
        average: metrics.memoryUsage.reduce((sum, m) => sum + m.used, 0) / metrics.memoryUsage.length,
        final: metrics.memoryUsage[metrics.memoryUsage.length - 1]?.used || 0
      } : { peak: 0, average: 0, final: 0 };

      // Stability metrics
      const fpsStdDev = calculateStandardDeviation(metrics.fps);
      const renderTimeStdDev = metrics.scores.length > 1
        ? calculateStandardDeviation(metrics.scores.map(s => s.renderTime))
        : 0;

      function calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
      }

      return {
        duration: performance.now() - metrics.startTime,
        fps: {
          average: avgFPS,
          min: Math.min(...metrics.fps),
          max: Math.max(...metrics.fps),
          stability: fpsStdDev
        },
        renderTime: {
          average: avgRenderTime,
          samples: metrics.scores.length
        },
        memory: {
          peakMB: memoryStats.peak / (1024 * 1024),
          averageMB: memoryStats.average / (1024 * 1024),
          finalMB: memoryStats.final / (1024 * 1024)
        },
        performance: {
          averageScore: avgScore,
          samples: metrics.scores.length
        },
        rawData: {
          fps: metrics.fps,
          scores: metrics.scores,
          memory: metrics.memoryUsage
        }
      };
    });
  }
}

// Benchmark runner
class BenchmarkRunner {
  constructor(config = BENCHMARK_CONFIG) {
    this.config = config;
    this.results = [];
    this.collector = new PerformanceCollector();
  }

  async run() {
    console.log('🚀 Starting Isometry Canvas Performance Benchmark');
    console.log(`Testing ${this.config.dataSizes.length} data sizes × ${this.config.viewTypes.length} views × ${this.config.performanceModes.length} modes = ${this.config.dataSizes.length * this.config.viewTypes.length * this.config.performanceModes.length} scenarios`);

    const browser = await puppeteer.launch({
      headless: this.config.browser.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--enable-precise-memory-info'
      ]
    });

    try {
      const results = [];

      for (const dataSize of this.config.dataSizes) {
        for (const viewType of this.config.viewTypes) {
          for (const mode of this.config.performanceModes) {
            console.log(`\n📊 Testing: ${dataSize} nodes, ${viewType} view, ${mode} quality`);

            const result = await this.runScenario(browser, {
              dataSize,
              viewType,
              performanceMode: mode
            });

            if (result) {
              results.push(result);
              this.logScenarioResult(result);
            }
          }
        }
      }

      this.results = results;
      await this.generateReport();

    } finally {
      await browser.close();
    }
  }

  async runScenario(browser, scenario) {
    const page = await browser.newPage();

    try {
      // Setup performance collection
      await this.collector.startCollection(page);

      // Configure viewport
      await page.setViewport({
        width: this.config.browser.width,
        height: this.config.browser.height
      });

      // Navigate to application
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

      // Wait for app to load
      await page.waitForSelector('.canvas-container', { timeout: 10000 });

      // Enable D3 mode
      await page.click('[title*="Switch to D3 rendering"]');

      // Set performance mode
      await page.select('select[title="Performance quality mode"]', scenario.performanceMode);

      // Switch to target view
      await this.switchToView(page, scenario.viewType);

      // Simulate data loading with target size
      await page.evaluate((dataSize) => {
        // Trigger data generation of specific size
        window.dispatchEvent(new CustomEvent('benchmark-set-data-size', {
          detail: { size: dataSize }
        }));
      }, scenario.dataSize);

      // Wait for rendering to settle
      await page.waitForTimeout(2000);

      // Run performance test for configured duration
      console.log(`  ⏱️  Running test for ${this.config.testDuration}ms...`);

      // Simulate user interactions during test
      await this.simulateInteractions(page);

      // Collect final metrics
      const metrics = await this.collector.collectMetrics(page);

      if (!metrics) {
        console.log('  ❌ Failed to collect metrics');
        return null;
      }

      return {
        scenario,
        metrics,
        passed: this.evaluatePerformance(metrics),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.log(`  ❌ Error in scenario: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async switchToView(page, viewType) {
    const viewMap = {
      grid: 'Grid',
      list: 'List',
      network: 'Graphs'
    };

    const targetView = viewMap[viewType];
    if (!targetView) return;

    // Click view switcher button
    await page.click(`[title*="${targetView}"]`);
    await page.waitForTimeout(1000);
  }

  async simulateInteractions(page) {
    const interactionDuration = this.config.testDuration;
    const startTime = Date.now();

    while (Date.now() - startTime < interactionDuration) {
      try {
        // Scroll canvas
        await page.evaluate(() => {
          const canvas = document.querySelector('.canvas-container');
          if (canvas) {
            canvas.scrollTop += Math.random() * 200 - 100;
            canvas.scrollLeft += Math.random() * 200 - 100;
          }
        });

        // Zoom simulation
        await page.keyboard.down('Control');
        await page.mouse.wheel({ deltaY: Math.random() * 200 - 100 });
        await page.keyboard.up('Control');

        // Click random elements
        const elements = await page.$$('.node-element, .d3-element');
        if (elements.length > 0) {
          const randomElement = elements[Math.floor(Math.random() * elements.length)];
          await randomElement.click().catch(() => {}); // Ignore click errors
        }

        await page.waitForTimeout(100);
      } catch (error) {
        // Continue on interaction errors
      }
    }
  }

  evaluatePerformance(metrics) {
    const { thresholds } = this.config;

    return {
      fps: metrics.fps.average >= thresholds.minFps,
      renderTime: metrics.renderTime.average <= thresholds.maxRenderTime,
      memory: metrics.memory.peakMB <= thresholds.maxMemoryMB,
      overall: metrics.performance.averageScore >= thresholds.minPerformanceScore,
      stability: metrics.fps.stability < 10 // Low standard deviation is good
    };
  }

  logScenarioResult(result) {
    const { scenario, metrics, passed } = result;
    const status = Object.values(passed).every(Boolean) ? '✅' : '⚠️';

    console.log(`  ${status} FPS: ${metrics.fps.average.toFixed(1)} | Render: ${metrics.renderTime.average.toFixed(1)}ms | Memory: ${metrics.memory.peakMB.toFixed(1)}MB | Score: ${metrics.performance.averageScore.toFixed(0)}`);
  }

  async generateReport() {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        config: this.config,
        totalScenarios: this.results.length,
        passedScenarios: this.results.filter(r => Object.values(r.passed).every(Boolean)).length
      },
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations(),
      results: this.results
    };

    // Write detailed report
    const reportPath = path.join(process.cwd(), 'benchmark-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Write human-readable report
    const readablePath = path.join(process.cwd(), 'benchmark-report.md');
    await fs.writeFile(readablePath, this.generateMarkdownReport(report));

    console.log(`\n📊 Benchmark Complete!`);
    console.log(`   Passed: ${report.metadata.passedScenarios}/${report.metadata.totalScenarios}`);
    console.log(`   Reports: ${reportPath}, ${readablePath}`);
  }

  generateSummary() {
    const summary = {
      performance: {},
      memory: {},
      stability: {}
    };

    // Group by data size
    this.config.dataSizes.forEach(size => {
      const sizeResults = this.results.filter(r => r.scenario.dataSize === size);

      if (sizeResults.length > 0) {
        const avgFps = sizeResults.reduce((sum, r) => sum + r.metrics.fps.average, 0) / sizeResults.length;
        const avgMemory = sizeResults.reduce((sum, r) => sum + r.metrics.memory.peakMB, 0) / sizeResults.length;

        summary.performance[size] = avgFps;
        summary.memory[size] = avgMemory;
      }
    });

    return summary;
  }

  generateRecommendations() {
    const recommendations = [];
    const failed = this.results.filter(r => !Object.values(r.passed).every(Boolean));

    // Performance recommendations
    if (failed.some(r => !r.passed.fps)) {
      recommendations.push('Enable Level of Detail (LOD) rendering for large datasets');
      recommendations.push('Implement viewport culling to reduce off-screen rendering');
    }

    if (failed.some(r => !r.passed.memory)) {
      recommendations.push('Enable object pooling to reduce garbage collection');
      recommendations.push('Implement progressive rendering for large datasets');
    }

    if (failed.some(r => !r.passed.stability)) {
      recommendations.push('Use requestAnimationFrame for smoother animations');
      recommendations.push('Batch DOM updates to reduce layout thrashing');
    }

    // Data size specific recommendations
    const largeSizeFailures = failed.filter(r => r.scenario.dataSize > 2000);
    if (largeSizeFailures.length > 0) {
      recommendations.push('For datasets >2000 nodes, use automatic quality reduction');
      recommendations.push('Consider virtual scrolling for list views with large datasets');
    }

    return recommendations;
  }

  generateMarkdownReport(report) {
    let markdown = `# Isometry Canvas Performance Benchmark Report\n\n`;
    markdown += `**Generated:** ${report.metadata.timestamp}\n`;
    markdown += `**Scenarios Tested:** ${report.metadata.totalScenarios}\n`;
    markdown += `**Passed:** ${report.metadata.passedScenarios}/${report.metadata.totalScenarios}\n\n`;

    markdown += `## Performance Summary\n\n`;
    markdown += `| Data Size | Avg FPS | Memory (MB) | Status |\n`;
    markdown += `|-----------|---------|-------------|--------|\n`;

    Object.entries(report.summary.performance).forEach(([size, fps]) => {
      const memory = report.summary.memory[size];
      const status = fps >= this.config.thresholds.minFps ? '✅' : '⚠️';
      markdown += `| ${size} | ${fps.toFixed(1)} | ${memory.toFixed(1)} | ${status} |\n`;
    });

    markdown += `\n## Recommendations\n\n`;
    report.recommendations.forEach(rec => {
      markdown += `- ${rec}\n`;
    });

    markdown += `\n## Performance Thresholds\n\n`;
    markdown += `- **Minimum FPS:** ${this.config.thresholds.minFps}\n`;
    markdown += `- **Maximum Render Time:** ${this.config.thresholds.maxRenderTime}ms\n`;
    markdown += `- **Maximum Memory:** ${this.config.thresholds.maxMemoryMB}MB\n`;
    markdown += `- **Minimum Performance Score:** ${this.config.thresholds.minPerformanceScore}\n`;

    return markdown;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const config = { ...BENCHMARK_CONFIG };

  // Parse CLI arguments
  if (args.includes('--quick')) {
    config.dataSizes = [100, 1000, 6891];
    config.testDuration = 5000;
  }

  if (args.includes('--headful')) {
    config.browser.headless = false;
  }

  const runner = new BenchmarkRunner(config);
  await runner.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BenchmarkRunner, PerformanceCollector, BENCHMARK_CONFIG };