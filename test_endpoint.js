/**
 * Test script for /dashboard/comparar endpoint performance
 */
require('dotenv').config();
const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const TEST_ITERATIONS = 5;
const BASE_URL = 'http://localhost:3000';
const ENDPOINT = '/dashboard/comparar';
const TEST_LIMITS = [100, 1000, 5000]; // Test different dataset sizes

async function runTests() {
  console.log('Testing /dashboard/comparar endpoint performance');
  console.log('==============================================\n');
  
  const results = {};
  
  for (const limit of TEST_LIMITS) {
    console.log(`\nTesting with limit=${limit}...\n`);
    results[limit] = [];
    
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      try {
        // Make request to the endpoint with the specified limit
        const response = await axios.get(`${BASE_URL}${ENDPOINT}?limit=${limit}`);
        
        // Extract timing data from response
        const { timeDirect, timeAggregation, timeCursor, timeAggCursor } = response.data;
        
        const end = performance.now();
        const requestTime = parseFloat((end - start).toFixed(2));
        
        // Store results
        results[limit].push({
          iteration: i + 1,
          requestTime,
          serverTimings: {
            timeDirect,
            timeAggregation,
            timeCursor,
            timeAggCursor
          }
        });
        
        console.log(`Iteration ${i + 1}: Request time ${requestTime}ms`);
        console.log(`  Server processing times:`);
        console.log(`  - Without cursor: ${timeDirect.toFixed(2)}ms`);
        console.log(`  - Aggregation: ${timeAggregation.toFixed(2)}ms`);
        console.log(`  - With cursor: ${timeCursor.toFixed(2)}ms`);
        console.log(`  - Agg cursor: ${timeAggCursor.toFixed(2)}ms`);
      } catch (error) {
        console.error(`Error in iteration ${i + 1}:`, error.message);
      }
    }
    
    // Calculate averages
    if (results[limit].length > 0) {
      const avgRequestTime = results[limit].reduce((sum, r) => sum + r.requestTime, 0) / results[limit].length;
      const avgDirect = results[limit].reduce((sum, r) => sum + r.serverTimings.timeDirect, 0) / results[limit].length;
      const avgAggregation = results[limit].reduce((sum, r) => sum + r.serverTimings.timeAggregation, 0) / results[limit].length;
      const avgCursor = results[limit].reduce((sum, r) => sum + r.serverTimings.timeCursor, 0) / results[limit].length;
      const avgAggCursor = results[limit].reduce((sum, r) => sum + r.serverTimings.timeAggCursor, 0) / results[limit].length;
      
      console.log(`\nResults for limit=${limit}:`);
      console.log(`Avg request time: ${avgRequestTime.toFixed(2)}ms`);
      console.log(`Avg server processing times:`);
      console.log(`- Without cursor: ${avgDirect.toFixed(2)}ms`);
      console.log(`- Aggregation: ${avgAggregation.toFixed(2)}ms`);
      console.log(`- With cursor: ${avgCursor.toFixed(2)}ms`);
      console.log(`- Agg cursor: ${avgAggCursor.toFixed(2)}ms`);
      
      // Calculate performance comparisons
      const fastestMethod = Math.min(avgDirect, avgAggregation, avgCursor, avgAggCursor);
      const cursorOverheadPercent = ((avgCursor - fastestMethod) / fastestMethod * 100).toFixed(2);
      
      console.log(`\nCursor overhead vs fastest method: ${cursorOverheadPercent}%`);
      console.log(`Performance ranking:`);
      const methods = [
        { name: 'Without cursor', time: avgDirect },
        { name: 'Aggregation', time: avgAggregation },
        { name: 'With cursor', time: avgCursor },
        { name: 'Agg cursor', time: avgAggCursor }
      ];
      methods.sort((a, b) => a.time - b.time);
      methods.forEach((method, idx) => {
        console.log(`${idx + 1}. ${method.name}: ${method.time.toFixed(2)}ms`);
      });
    }
  }
}

runTests().catch(console.error); 