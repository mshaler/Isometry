/**
 * Security Validation and Testing Utilities
 *
 * Comprehensive security validation for all implemented security measures
 * including input sanitization, encrypted storage, API proxy configuration,
 * and environment security.
 */

import {
  sanitizeString,
  sanitizeDSLValue,
  sanitizeFieldName,
  sanitizeOperator,
  isSecurityRisk
} from './input-sanitization';
import {
  isEncryptedStorageSupported,
  setEncryptedItem,
  getEncryptedItem,
  getEncryptionInfo
} from './encrypted-storage';
import {
  getSecurityConfig,
  validateSecurityConfig,
  shouldUseAPIProxy
} from '../config/security';
import {
  getEnvironmentConfig,
  validateEnvironmentSecurity,
  getSecureWorkingDirectory
} from '../config/environment';

/**
 * Security test result
 */
export interface SecurityTestResult {
  testName: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details?: Record<string, unknown>;
}

/**
 * Complete security validation report
 */
export interface SecurityValidationReport {
  timestamp: string;
  overallStatus: 'pass' | 'warning' | 'fail';
  score: number; // 0-100
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warningTests: number;
  criticalIssues: number;
  results: SecurityTestResult[];
  recommendations: string[];
}

/**
 * Tests input sanitization functionality
 */
async function testInputSanitization(): Promise<SecurityTestResult[]> {
  const results: SecurityTestResult[] = [];

  // Test SQL injection prevention
  try {
    const maliciousInput = "'; DROP TABLE users; --";
    const result = sanitizeString(maliciousInput, { escapeSQL: true });

    if (result.isValid || !result.errors.some(e => e.includes('SQL injection'))) {
      results.push({
        testName: 'SQL Injection Prevention',
        passed: false,
        message: 'Failed to detect SQL injection pattern',
        severity: 'critical',
        details: { input: maliciousInput, result }
      });
    } else {
      results.push({
        testName: 'SQL Injection Prevention',
        passed: true,
        message: 'Successfully detected and prevented SQL injection',
        severity: 'info'
      });
    }
  } catch (error) {
    results.push({
      testName: 'SQL Injection Prevention',
      passed: false,
      message: `SQL injection test error: ${error}`,
      severity: 'error'
    });
  }

  // Test XSS prevention
  try {
    const xssInput = '<script>alert("XSS")</script>';
    const result = sanitizeString(xssInput, { stripHTML: true });

    if (result.errors.some(e => e.includes('XSS')) || result.sanitizedValue !== xssInput) {
      results.push({
        testName: 'XSS Prevention',
        passed: true,
        message: 'Successfully detected and prevented XSS',
        severity: 'info'
      });
    } else {
      results.push({
        testName: 'XSS Prevention',
        passed: false,
        message: 'Failed to detect XSS pattern',
        severity: 'critical'
      });
    }
  } catch (error) {
    results.push({
      testName: 'XSS Prevention',
      passed: false,
      message: `XSS prevention test error: ${error}`,
      severity: 'error'
    });
  }

  // Test field name validation
  try {
    const maliciousField = 'user_id\'; DROP TABLE users; --';
    const result = sanitizeFieldName(maliciousField);

    if (result.isValid) {
      results.push({
        testName: 'Field Name Validation',
        passed: false,
        message: 'Failed to reject malicious field name',
        severity: 'critical'
      });
    } else {
      results.push({
        testName: 'Field Name Validation',
        passed: true,
        message: 'Successfully rejected malicious field name',
        severity: 'info'
      });
    }
  } catch (error) {
    results.push({
      testName: 'Field Name Validation',
      passed: false,
      message: `Field validation test error: ${error}`,
      severity: 'error'
    });
  }

  // Test operator validation
  try {
    const maliciousOperator = '= OR 1=1; --';
    const result = sanitizeOperator(maliciousOperator);

    if (result.isValid) {
      results.push({
        testName: 'Operator Validation',
        passed: false,
        message: 'Failed to reject malicious operator',
        severity: 'critical'
      });
    } else {
      results.push({
        testName: 'Operator Validation',
        passed: true,
        message: 'Successfully rejected malicious operator',
        severity: 'info'
      });
    }
  } catch (error) {
    results.push({
      testName: 'Operator Validation',
      passed: false,
      message: `Operator validation test error: ${error}`,
      severity: 'error'
    });
  }

  // Test DSL value sanitization
  try {
    const maliciousValue = { preset: "today'; DROP TABLE nodes; --" };
    const result = sanitizeDSLValue(maliciousValue);

    if (result.isValid && !isSecurityRisk(result)) {
      results.push({
        testName: 'DSL Value Sanitization',
        passed: false,
        message: 'Failed to detect security risk in DSL value',
        severity: 'critical'
      });
    } else {
      results.push({
        testName: 'DSL Value Sanitization',
        passed: true,
        message: 'Successfully detected security risk in DSL value',
        severity: 'info'
      });
    }
  } catch (error) {
    results.push({
      testName: 'DSL Value Sanitization',
      passed: false,
      message: `DSL validation test error: ${error}`,
      severity: 'error'
    });
  }

  return results;
}

/**
 * Tests encrypted storage functionality
 */
async function testEncryptedStorage(): Promise<SecurityTestResult[]> {
  const results: SecurityTestResult[] = [];

  // Test encryption support
  try {
    const supported = isEncryptedStorageSupported();

    if (!supported) {
      results.push({
        testName: 'Encryption Support',
        passed: false,
        message: 'Web Crypto API not supported in this environment',
        severity: 'warning'
      });
    } else {
      results.push({
        testName: 'Encryption Support',
        passed: true,
        message: 'Web Crypto API supported',
        severity: 'info'
      });

      // Test encryption/decryption cycle
      try {
        const testData = { secret: 'test-secret-data', timestamp: Date.now() };
        const testKey = 'security-test-data';

        const setResult = await setEncryptedItem(testKey, testData);

        if (!setResult.success) {
          results.push({
            testName: 'Encryption Storage',
            passed: false,
            message: `Failed to encrypt and store data: ${setResult.error}`,
            severity: 'critical'
          });
        } else {
          const getResult = await getEncryptedItem<typeof testData>(testKey);

          if (!getResult.success || !getResult.data) {
            results.push({
              testName: 'Encryption Retrieval',
              passed: false,
              message: `Failed to decrypt and retrieve data: ${getResult.error}`,
              severity: 'critical'
            });
          } else if (getResult.data.secret !== testData.secret) {
            results.push({
              testName: 'Encryption Integrity',
              passed: false,
              message: 'Decrypted data does not match original',
              severity: 'critical'
            });
          } else {
            results.push({
              testName: 'Encryption Round-trip',
              passed: true,
              message: 'Successfully encrypted, stored, and decrypted data',
              severity: 'info'
            });

            // Clean up test data
            localStorage.removeItem(`encrypted:${testKey}`);
          }
        }
      } catch (error) {
        results.push({
          testName: 'Encryption Operations',
          passed: false,
          message: `Encryption test error: ${error}`,
          severity: 'error'
        });
      }
    }
  } catch (error) {
    results.push({
      testName: 'Encryption Support Check',
      passed: false,
      message: `Encryption support check error: ${error}`,
      severity: 'error'
    });
  }

  // Test encryption info
  try {
    const info = getEncryptionInfo();

    results.push({
      testName: 'Encryption Configuration',
      passed: info.supported && info.algorithm === 'AES-GCM' && info.keyLength === 256,
      message: `Encryption: ${info.algorithm}, Key length: ${info.keyLength}`,
      severity: info.supported ? 'info' : 'warning',
      details: info
    });
  } catch (error) {
    results.push({
      testName: 'Encryption Information',
      passed: false,
      message: `Encryption info error: ${error}`,
      severity: 'error'
    });
  }

  return results;
}

/**
 * Tests API proxy security configuration
 */
async function testAPIProxySecurity(): Promise<SecurityTestResult[]> {
  const results: SecurityTestResult[] = [];

  try {
    const securityConfig = getSecurityConfig();
    const validation = validateSecurityConfig();

    if (!validation.valid) {
      results.push({
        testName: 'Security Configuration Validation',
        passed: false,
        message: `Invalid security config: ${validation.errors.join(', ')}`,
        severity: 'critical',
        details: { config: securityConfig, errors: validation.errors }
      });
    } else {
      results.push({
        testName: 'Security Configuration Validation',
        passed: true,
        message: 'Security configuration is valid',
        severity: 'info'
      });
    }

    // Test proxy configuration
    const useProxy = shouldUseAPIProxy();

    if (securityConfig.isProduction && !useProxy) {
      results.push({
        testName: 'Production Proxy Requirement',
        passed: false,
        message: 'Production environment must use API proxy',
        severity: 'critical'
      });
    } else {
      results.push({
        testName: 'API Proxy Configuration',
        passed: true,
        message: `API proxy ${useProxy ? 'enabled' : 'disabled (development mode)'}`,
        severity: 'info'
      });
    }

    // Test allowed origins
    if (securityConfig.allowedOrigins.length === 0) {
      results.push({
        testName: 'CORS Configuration',
        passed: false,
        message: 'No allowed origins configured',
        severity: 'warning'
      });
    } else {
      results.push({
        testName: 'CORS Configuration',
        passed: true,
        message: `${securityConfig.allowedOrigins.length} allowed origins configured`,
        severity: 'info'
      });
    }
  } catch (error) {
    results.push({
      testName: 'API Security Configuration',
      passed: false,
      message: `API security test error: ${error}`,
      severity: 'error'
    });
  }

  return results;
}

/**
 * Tests environment security configuration
 */
async function testEnvironmentSecurity(): Promise<SecurityTestResult[]> {
  const results: SecurityTestResult[] = [];

  try {
    const envConfig = getEnvironmentConfig();
    const validation = validateEnvironmentSecurity();

    // Test environment detection
    results.push({
      testName: 'Environment Detection',
      passed: true,
      message: `Environment: ${envConfig.type}, Security level: ${envConfig.securityLevel}`,
      severity: 'info',
      details: {
        type: envConfig.type,
        securityLevel: envConfig.securityLevel,
        isProduction: envConfig.isProduction
      }
    });

    // Test security validation
    if (!validation.valid) {
      results.push({
        testName: 'Environment Security Validation',
        passed: false,
        message: `Security validation failed: ${validation.errors.join(', ')}`,
        severity: 'critical',
        details: { errors: validation.errors, warnings: validation.warnings }
      });
    } else {
      results.push({
        testName: 'Environment Security Validation',
        passed: true,
        message: 'Environment security validation passed',
        severity: 'info'
      });

      // Add warnings as separate results
      validation.warnings.forEach(warning => {
        results.push({
          testName: 'Environment Security Warning',
          passed: true,
          message: warning,
          severity: 'warning'
        });
      });
    }

    // Test secure path configuration
    try {
      const workingDir = getSecureWorkingDirectory();

      if (workingDir.includes('/Users/') && envConfig.isProduction) {
        results.push({
          testName: 'Secure Path Configuration',
          passed: false,
          message: 'Production using hardcoded user-specific paths',
          severity: 'critical'
        });
      } else {
        results.push({
          testName: 'Secure Path Configuration',
          passed: true,
          message: 'Working directory properly configured',
          severity: 'info'
        });
      }
    } catch (error) {
      if (envConfig.isProduction) {
        results.push({
          testName: 'Secure Path Configuration',
          passed: false,
          message: `Production path configuration error: ${error}`,
          severity: 'critical'
        });
      } else {
        results.push({
          testName: 'Secure Path Configuration',
          passed: true,
          message: 'Development fallback paths acceptable',
          severity: 'info'
        });
      }
    }
  } catch (error) {
    results.push({
      testName: 'Environment Security Test',
      passed: false,
      message: `Environment security test error: ${error}`,
      severity: 'error'
    });
  }

  return results;
}

/**
 * Generates recommendations based on test results
 */
function generateRecommendations(results: SecurityTestResult[]): string[] {
  const recommendations: string[] = [];
  const envConfig = getEnvironmentConfig();

  // Check for critical failures
  const criticalFailures = results.filter(r => !r.passed && r.severity === 'critical');

  if (criticalFailures.length > 0) {
    recommendations.push('🚨 Critical security issues found - immediate action required');
    criticalFailures.forEach(failure => {
      recommendations.push(`- Fix: ${failure.message}`);
    });
  }

  // Environment-specific recommendations
  if (envConfig.isProduction) {
    const prodIssues = results.filter(r =>
      r.severity === 'warning' && r.message.toLowerCase().includes('production')
    );

    if (prodIssues.length > 0) {
      recommendations.push('⚠️  Production environment optimizations:');
      prodIssues.forEach(issue => {
        recommendations.push(`- ${issue.message}`);
      });
    }
  }

  // Feature-specific recommendations
  const encryptionIssues = results.filter(r =>
    r.testName.includes('Encryption') && (!r.passed || r.severity === 'warning')
  );

  if (encryptionIssues.length > 0) {
    recommendations.push('🔒 Encryption improvements:');
    recommendations.push('- Ensure all sensitive data uses encrypted storage');
    recommendations.push('- Consider implementing key rotation for long-lived data');
  }

  // General security recommendations
  if (results.some(r => r.testName.includes('XSS') && !r.passed)) {
    recommendations.push('🛡️  Input validation improvements needed');
  }

  if (results.some(r => r.testName.includes('SQL') && !r.passed)) {
    recommendations.push('💉 SQL injection protection must be implemented');
  }

  // Positive reinforcement
  const passedCriticalTests = results.filter(r =>
    r.passed && (r.testName.includes('SQL') || r.testName.includes('XSS') || r.testName.includes('Encryption'))
  );

  if (passedCriticalTests.length > 3) {
    recommendations.push('✅ Strong security foundation established');
  }

  return recommendations;
}

/**
 * Runs comprehensive security validation
 */
export async function validateSecurityMeasures(): Promise<SecurityValidationReport> {
  const timestamp = new Date().toISOString();
  const allResults: SecurityTestResult[] = [];

  try {
    // Run all security tests
    const inputSanitizationResults = await testInputSanitization();
    const encryptedStorageResults = await testEncryptedStorage();
    const apiProxyResults = await testAPIProxySecurity();
    const environmentResults = await testEnvironmentSecurity();

    allResults.push(...inputSanitizationResults);
    allResults.push(...encryptedStorageResults);
    allResults.push(...apiProxyResults);
    allResults.push(...environmentResults);

    // Calculate metrics
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.passed).length;
    const failedTests = allResults.filter(r => !r.passed).length;
    const warningTests = allResults.filter(r => r.severity === 'warning').length;
    const criticalIssues = allResults.filter(r => !r.passed && r.severity === 'critical').length;

    // Calculate security score (0-100)
    const baseScore = (passedTests / totalTests) * 100;
    const criticalPenalty = criticalIssues * 20;
    const warningPenalty = warningTests * 5;
    const score = Math.max(0, Math.min(100, baseScore - criticalPenalty - warningPenalty));

    // Determine overall status
    let overallStatus: 'pass' | 'warning' | 'fail';

    if (criticalIssues > 0) {
      overallStatus = 'fail';
    } else if (warningTests > 0 || score < 80) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'pass';
    }

    const recommendations = generateRecommendations(allResults);

    return {
      timestamp,
      overallStatus,
      score: Math.round(score),
      totalTests,
      passedTests,
      failedTests,
      warningTests,
      criticalIssues,
      results: allResults,
      recommendations
    };
  } catch (error) {
    // Fallback error result
    allResults.push({
      testName: 'Security Validation Framework',
      passed: false,
      message: `Validation framework error: ${error}`,
      severity: 'error'
    });

    return {
      timestamp,
      overallStatus: 'fail',
      score: 0,
      totalTests: allResults.length,
      passedTests: 0,
      failedTests: allResults.length,
      warningTests: 0,
      criticalIssues: 1,
      results: allResults,
      recommendations: ['🚨 Security validation framework error - manual review required']
    };
  }
}

/**
 * Logs security validation report to console
 */
export function logSecurityReport(report: SecurityValidationReport): void {
  const statusEmoji = report.overallStatus === 'pass' ? '✅' : report.overallStatus === 'warning' ? '⚠️' : '❌';

  console.group(`🔒 Security Validation Report ${statusEmoji}`);
  console.log(`Status: ${report.overallStatus.toUpperCase()}`);
  console.log(`Score: ${report.score}/100`);
  console.log(`Tests: ${report.passedTests}/${report.totalTests} passed`);

  if (report.criticalIssues > 0) {
    console.error(`❌ Critical issues: ${report.criticalIssues}`);
  }

  if (report.warningTests > 0) {
    console.warn(`⚠️  Warnings: ${report.warningTests}`);
  }

  // Log failed tests
  const failedTests = report.results.filter(r => !r.passed);

  if (failedTests.length > 0) {
    console.group('❌ Failed Tests:');
    failedTests.forEach(test => {
      console.error(`${test.testName}: ${test.message}`);
      if (test.details) {
        // Test details suppressed for production
      }
    });
    console.groupEnd();
  }

  // Log recommendations
  if (report.recommendations.length > 0) {
    console.group('📋 Recommendations:');
    report.recommendations.forEach(rec => console.log(rec));
    console.groupEnd();
  }

  console.groupEnd();
}