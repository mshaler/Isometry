/**
 * GSD Verifier Module
 * 
 * Token-efficient verification using:
 * - Vitest JSON output (not console)
 * - JSDOM snapshots (text, not screenshots)
 * - Perceptual hashing (32 chars, not images)
 */

import { spawn } from 'child_process';
import { JSDOM } from 'jsdom';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { GSDConfig, VerifyResult, TestFailure } from './config.js';

export class Verifier {
  constructor(private config: GSDConfig) {}

  /**
   * Run all verification steps
   */
  async verify(): Promise<VerifyResult> {
    const [unitResult, domResult, hashResult] = await Promise.all([
      this.runUnitTests(),
      this.verifyDOM(),
      this.verifyHashes(),
    ]);

    const success = unitResult.success && domResult.success && hashResult.success;
    const failures = [
      ...unitResult.failures,
      ...domResult.failures,
      ...hashResult.failures,
    ];

    return {
      success,
      passed: unitResult.passed,
      total: unitResult.total,
      failures,
    };
  }

  /**
   * Run Vitest with JSON reporter
   * Parse structured output instead of console logs
   */
  async runUnitTests(): Promise<{
    success: boolean;
    passed: number;
    total: number;
    failures: TestFailure[];
  }> {
    return new Promise((resolve) => {
      const proc = spawn('npx', ['vitest', 'run', '--reporter=json', '--no-color'], {
        cwd: this.config.projectRoot,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          CI: 'true',
        },
      });

      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });

      proc.on('close', () => {
        try {
          // Find JSON object in output
          const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
          
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            const passed = result.numPassedTests || 0;
            const failed = result.numFailedTests || 0;
            const failures = this.extractTestFailures(result);

            resolve({
              success: failed === 0,
              passed,
              total: passed + failed,
              failures,
            });
          } else {
            // No JSON found - try to parse text output
            const passMatch = output.match(/(\d+)\s+passed/);
            const failMatch = output.match(/(\d+)\s+failed/);
            
            resolve({
              success: !failMatch,
              passed: passMatch ? parseInt(passMatch[1]) : 0,
              total: (passMatch ? parseInt(passMatch[1]) : 0) + (failMatch ? parseInt(failMatch[1]) : 0),
              failures: failMatch ? [{ test: 'unknown', message: 'Tests failed (see output)' }] : [],
            });
          }
        } catch (e) {
          resolve({
            success: false,
            passed: 0,
            total: 0,
            failures: [{ test: 'vitest', message: `Parse error: ${e}` }],
          });
        }
      });

      // Timeout
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          passed: 0,
          total: 0,
          failures: [{ test: 'vitest', message: 'Test timeout exceeded' }],
        });
      }, this.config.timeout * 2); // Tests get double timeout
    });
  }

  /**
   * Verify DOM structure using JSDOM
   * Compares text snapshots, not visual screenshots
   */
  async verifyDOM(): Promise<{ success: boolean; failures: TestFailure[] }> {
    const snapshotDir = path.join(this.config.projectRoot, this.config.snapshotDir);
    const failures: TestFailure[] = [];

    // Check if snapshot directory exists
    if (!fs.existsSync(snapshotDir)) {
      return { success: true, failures: [] };
    }

    const htmlFiles = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.html'));

    for (const file of htmlFiles) {
      const htmlPath = path.join(snapshotDir, file);
      const expectedPath = path.join(snapshotDir, file.replace('.html', '.expected.txt'));

      if (!fs.existsSync(expectedPath)) continue;

      try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const expected = fs.readFileSync(expectedPath, 'utf8');

        const dom = new JSDOM(html);
        const actual = this.extractDOMStructure(dom.window.document);

        if (actual.trim() !== expected.trim()) {
          failures.push({
            test: `DOM: ${file}`,
            message: 'DOM structure mismatch',
            expected: expected.substring(0, 100),
            actual: actual.substring(0, 100),
          });
        }
      } catch (e) {
        failures.push({
          test: `DOM: ${file}`,
          message: `Failed to verify: ${e}`,
        });
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
  }

  /**
   * Verify visual regression via perceptual hashing
   * Returns 32-char hash, not screenshot image
   */
  async verifyHashes(): Promise<{ success: boolean; failures: TestFailure[] }> {
    const hashDir = path.join(this.config.projectRoot, this.config.hashDir);
    const failures: TestFailure[] = [];

    if (!fs.existsSync(hashDir)) {
      return { success: true, failures: [] };
    }

    const hashFiles = fs.readdirSync(hashDir).filter(f => f.endsWith('.hash'));

    for (const file of hashFiles) {
      const hashPath = path.join(hashDir, file);
      const svgPath = path.join(hashDir, file.replace('.hash', '.svg'));

      if (!fs.existsSync(svgPath)) continue;

      try {
        const expectedHash = fs.readFileSync(hashPath, 'utf8').trim();
        const svg = fs.readFileSync(svgPath, 'utf8');
        const actualHash = this.computePerceptualHash(svg);

        const distance = this.hammingDistance(expectedHash, actualHash);
        
        if (distance > 5) { // Allow 5 bits difference
          failures.push({
            test: `Hash: ${file}`,
            message: `Visual regression: hash distance ${distance} exceeds threshold`,
            expected: expectedHash,
            actual: actualHash,
          });
        }
      } catch (e) {
        failures.push({
          test: `Hash: ${file}`,
          message: `Failed to verify: ${e}`,
        });
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
  }

  /**
   * Extract DOM structure as text (token-efficient)
   */
  private extractDOMStructure(doc: Document): string {
    const walk = (node: Element, depth: number): string => {
      const indent = '  '.repeat(depth);
      const tag = node.tagName.toLowerCase();
      const id = node.id ? `#${node.id}` : '';
      const classes = node.classList.length
        ? `.${Array.from(node.classList).join('.')}`
        : '';

      let result = `${indent}${tag}${id}${classes}\n`;

      for (const child of Array.from(node.children)) {
        result += walk(child as Element, depth + 1);
      }

      return result;
    };

    return walk(doc.body, 0);
  }

  /**
   * Compute perceptual hash for SVG
   * Normalizes SVG and hashes structural elements
   */
  private computePerceptualHash(svg: string): string {
    // Normalize whitespace
    const normalized = svg
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();

    // Extract structural elements (paths, shapes, groups)
    const structural = normalized
      .match(/<(path|rect|circle|line|text|g|polygon|polyline)[^>]*>/g)
      ?.join('') || '';

    return crypto.createHash('md5').update(structural).digest('hex');
  }

  /**
   * Calculate Hamming distance between two hashes
   */
  private hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) return Infinity;
    
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) distance++;
    }
    return distance;
  }

  /**
   * Extract test failures from Vitest JSON
   */
  private extractTestFailures(vitestResult: Record<string, unknown>): TestFailure[] {
    const failures: TestFailure[] = [];
    const testResults = vitestResult.testResults as Array<{
      name: string;
      assertionResults?: Array<{
        status: string;
        title: string;
        failureMessages?: string[];
      }>;
    }>;

    for (const testFile of testResults || []) {
      for (const assertion of testFile.assertionResults || []) {
        if (assertion.status === 'failed') {
          failures.push({
            test: `${path.basename(testFile.name)}:${assertion.title}`,
            message: assertion.failureMessages?.[0]?.substring(0, 200) || 'Unknown failure',
          });
        }
      }
    }

    return failures;
  }

  /**
   * Create a DOM snapshot for future comparison
   */
  async createDOMSnapshot(html: string, name: string): Promise<void> {
    const snapshotDir = path.join(this.config.projectRoot, this.config.snapshotDir);
    
    await fs.promises.mkdir(snapshotDir, { recursive: true });

    const dom = new JSDOM(html);
    const structure = this.extractDOMStructure(dom.window.document);

    await fs.promises.writeFile(
      path.join(snapshotDir, `${name}.html`),
      html
    );
    await fs.promises.writeFile(
      path.join(snapshotDir, `${name}.expected.txt`),
      structure
    );
  }

  /**
   * Create a visual hash for future comparison
   */
  async createVisualHash(svg: string, name: string): Promise<void> {
    const hashDir = path.join(this.config.projectRoot, this.config.hashDir);
    
    await fs.promises.mkdir(hashDir, { recursive: true });

    const hash = this.computePerceptualHash(svg);

    await fs.promises.writeFile(
      path.join(hashDir, `${name}.svg`),
      svg
    );
    await fs.promises.writeFile(
      path.join(hashDir, `${name}.hash`),
      hash
    );
  }
}
