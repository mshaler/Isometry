/**
 * Live Data Integration Test Script
 *
 * Tests end-to-end live data flow and performance
 * Run in browser console when the app is running
 */

(function testLiveDataIntegration() {
  console.log('🚀 Starting Live Data Integration Test...');

  const results = {
    bridgeAvailable: false,
    subscriptionTest: false,
    performanceTest: false,
    errorHandlingTest: false,
    changeNotificationTest: false,
    averageLatency: 0,
    errors: []
  };

  // Test 1: Check bridge availability
  console.log('📡 Test 1: Bridge Availability');
  results.bridgeAvailable = typeof window._isometryBridge !== 'undefined';
  console.log(`Bridge available: ${results.bridgeAvailable}`);

  if (!results.bridgeAvailable) {
    console.error('❌ Bridge not available - cannot run integration tests');
    return results;
  }

  // Test 2: Basic subscription test
  async function testBasicSubscription() {
    console.log('📊 Test 2: Basic Subscription');
    const startTime = performance.now();

    try {
      const response = await window._isometryBridge.sendMessage('database', 'subscribe', {
        subscriptionId: 'test-subscription',
        sql: 'SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL',
        params: [],
        intervalMs: 1000
      });

      const latency = performance.now() - startTime;
      results.averageLatency = latency;
      results.subscriptionTest = response.subscriptionId === 'test-subscription';

      console.log(`Subscription created in ${latency.toFixed(2)}ms`);
      console.log('Response:', response);

      // Clean up subscription
      await window._isometryBridge.sendMessage('database', 'unsubscribe', {
        subscriptionId: 'test-subscription'
      });

    } catch (error) {
      console.error('Subscription test failed:', error);
      results.errors.push(`Subscription: ${error.message}`);
    }
  }

  // Test 3: Performance test with multiple subscriptions
  async function testPerformance() {
    console.log('⚡ Test 3: Performance Test');
    const testCount = 5;
    const latencies = [];

    try {
      for (let i = 0; i < testCount; i++) {
        const startTime = performance.now();

        await window._isometryBridge.sendMessage('database', 'subscribe', {
          subscriptionId: `perf-test-${i}`,
          sql: `SELECT id, title FROM nodes WHERE deleted_at IS NULL LIMIT ${10 + i * 5}`,
          params: [],
          intervalMs: 2000
        });

        const latency = performance.now() - startTime;
        latencies.push(latency);

        // Clean up immediately
        await window._isometryBridge.sendMessage('database', 'unsubscribe', {
          subscriptionId: `perf-test-${i}`
        });
      }

      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      results.averageLatency = avgLatency;
      results.performanceTest = avgLatency < 100; // Target < 100ms

      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`Performance target met: ${results.performanceTest}`);

    } catch (error) {
      console.error('Performance test failed:', error);
      results.errors.push(`Performance: ${error.message}`);
    }
  }

  // Test 4: Error handling
  async function testErrorHandling() {
    console.log('🚨 Test 4: Error Handling');

    try {
      // Test invalid SQL
      await window._isometryBridge.sendMessage('database', 'subscribe', {
        subscriptionId: 'error-test',
        sql: 'SELECT * FROM non_existent_table',
        params: [],
        intervalMs: 1000
      });

      console.error('Expected error but subscription succeeded');

    } catch (error) {
      // Expected error
      results.errorHandlingTest = true;
      console.log('✅ Error handling working correctly:', error.message);
    }
  }

  // Test 5: Change notifications
  async function testChangeNotifications() {
    console.log('🔔 Test 5: Change Notifications');

    try {
      // Enable change notifications
      const response = await window._isometryBridge.sendMessage('database', 'enableChangeNotifications', {
        tables: ['nodes']
      });

      results.changeNotificationTest = response.status === 'enabled';
      console.log('Change notifications enabled:', response);

      // Disable after test
      await window._isometryBridge.sendMessage('database', 'disableChangeNotifications', {});

    } catch (error) {
      console.error('Change notification test failed:', error);
      results.errors.push(`Change notifications: ${error.message}`);
    }
  }

  // Run all tests sequentially
  async function runTests() {
    await testBasicSubscription();
    await testPerformance();
    await testErrorHandling();
    await testChangeNotifications();

    // Summary
    console.log('\n📋 Test Results Summary:');
    console.log('========================');
    console.log(`Bridge Available: ${results.bridgeAvailable ? '✅' : '❌'}`);
    console.log(`Subscription Test: ${results.subscriptionTest ? '✅' : '❌'}`);
    console.log(`Performance Test: ${results.performanceTest ? '✅' : '❌'} (${results.averageLatency.toFixed(2)}ms avg)`);
    console.log(`Error Handling: ${results.errorHandlingTest ? '✅' : '❌'}`);
    console.log(`Change Notifications: ${results.changeNotificationTest ? '✅' : '❌'}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    const passedTests = Object.values(results).filter(v => v === true).length;
    const totalTests = Object.keys(results).filter(k => typeof results[k] === 'boolean').length;

    console.log(`\n🏁 Overall: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests && results.averageLatency < 100) {
      console.log('🎉 All tests passed with <100ms latency target met!');
    } else {
      console.log('⚠️ Some tests failed or performance target not met');
    }

    return results;
  }

  // Store test function globally for manual execution
  window.testLiveDataIntegration = runTests;

  // Auto-run tests
  return runTests();
})();

// Usage:
// 1. Open browser dev tools
// 2. Navigate to the app with live data integration
// 3. Run: testLiveDataIntegration()
// 4. Check console for results