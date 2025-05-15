/**
 * MongoDB Cursor Performance Monitor
 * 
 * This script periodically runs tests to monitor the performance of different MongoDB cursor
 * approaches after our optimizations have been applied.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
const COLLECTION_NAME = 'cursors';
const TEST_ITERATIONS = 3;
const DOCUMENT_LIMIT = 100;
const LOG_FILE = path.join(__dirname, 'cursor_performance_log.json');
const MONITOR_INTERVAL = 1000 * 60 * 60; // Run tests every hour

// Initialize log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({
    logs: [],
    summary: {
      bestPerformer: null,
      worstPerformer: null,
      averages: {}
    }
  }, null, 2));
  
  console.log(`Created new log file: ${LOG_FILE}`);
}

// Create Mongoose schema for testing
const cursorSchema = new mongoose.Schema({
  nombre: String,
  edad: Number,
  ciudad: String,
  fechaCreacion: { type: Date, default: Date.now }
});

// Document processing function to simulate workload
const processDocument = (doc) => {
  let result = { ...doc };
  for (let i = 0; i < 1000; i++) {
    result._simulatedField = Math.sqrt(i) * Math.random();
  }
  return result;
};

// Run performance tests
async function runPerformanceTests() {
  console.log(`\n[${new Date().toISOString()}] Running MongoDB cursor performance tests...`);
  
  try {
    // Connect MongoDB clients
    const nativeClient = new MongoClient(MONGODB_URI);
    await nativeClient.connect();
    console.log('Connected to MongoDB with native driver');
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB with Mongoose');
    
    const CursorModel = mongoose.model('Cursor', cursorSchema);
    const nativeCollection = nativeClient.db().collection(COLLECTION_NAME);
    
    // Test results
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    // Test 1: Native MongoDB driver with toArray
    const nativeDriverResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const documents = await nativeCollection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(500)
        .toArray();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      nativeDriverResults.push(time);
    }
    results.tests.nativeDriver = {
      times: nativeDriverResults,
      average: nativeDriverResults.reduce((a, b) => a + b, 0) / nativeDriverResults.length
    };
    
    // Test 2: Mongoose with lean()
    const mongooseLeanResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const documents = await CursorModel.find({})
        .limit(DOCUMENT_LIMIT)
        .select('nombre edad ciudad fechaCreacion')
        .sort({ fechaCreacion: -1 })
        .lean()
        .exec();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      mongooseLeanResults.push(time);
    }
    results.tests.mongooseLean = {
      times: mongooseLeanResults,
      average: mongooseLeanResults.reduce((a, b) => a + b, 0) / mongooseLeanResults.length
    };
    
    // Test 3: Mongoose (regular)
    const mongooseResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const documents = await CursorModel.find({})
        .limit(DOCUMENT_LIMIT)
        .select('nombre edad ciudad fechaCreacion')
        .sort({ fechaCreacion: -1 })
        .exec();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      mongooseResults.push(time);
    }
    results.tests.mongoose = {
      times: mongooseResults,
      average: mongooseResults.reduce((a, b) => a + b, 0) / mongooseResults.length
    };
    
    // Test 4: Native cursor with forEach
    const forEachResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = nativeCollection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(500);
      
      const processed = [];
      await cursor.forEach(doc => {
        processed.push(processDocument(doc));
      });
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      forEachResults.push(time);
    }
    results.tests.forEach = {
      times: forEachResults,
      average: forEachResults.reduce((a, b) => a + b, 0) / forEachResults.length
    };
    
    // Calculate best and worst performers
    const testAverages = Object.entries(results.tests).map(([key, value]) => ({
      name: key,
      average: value.average
    }));
    
    const bestPerformer = testAverages.reduce((best, current) => 
      current.average < best.average ? current : best, testAverages[0]);
      
    const worstPerformer = testAverages.reduce((worst, current) => 
      current.average > worst.average ? current : worst, testAverages[0]);
    
    results.summary = {
      bestPerformer: bestPerformer.name,
      bestPerformerAvg: bestPerformer.average,
      worstPerformer: worstPerformer.name,
      worstPerformerAvg: worstPerformer.average,
      performanceGap: parseFloat(((worstPerformer.average - bestPerformer.average) / bestPerformer.average * 100).toFixed(2))
    };
    
    // Log the results
    const logData = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    logData.logs.push(results);
    
    // Update summary data
    const allLogs = logData.logs;
    const methods = ['nativeDriver', 'mongooseLean', 'mongoose', 'forEach'];
    
    const averages = {};
    methods.forEach(method => {
      const values = allLogs
        .filter(log => log.tests[method])
        .map(log => log.tests[method].average);
        
      if (values.length > 0) {
        averages[method] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
      }
    });
    
    logData.summary = {
      totalRuns: allLogs.length,
      latestRun: results.timestamp,
      averages,
      mostEfficientMethod: Object.entries(averages).reduce((best, [key, value]) => 
        value < best.value ? { key, value } : best, 
        { key: '', value: Infinity }).key
    };
    
    fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
    
    console.log('\nPerformance Test Results:');
    console.log(`Native Driver:   ${results.tests.nativeDriver.average.toFixed(2)}ms`);
    console.log(`Mongoose Lean:   ${results.tests.mongooseLean.average.toFixed(2)}ms`);
    console.log(`Mongoose:        ${results.tests.mongoose.average.toFixed(2)}ms`);
    console.log(`forEach:         ${results.tests.forEach.average.toFixed(2)}ms`);
    console.log(`\nBest performer: ${results.summary.bestPerformer} (${results.summary.bestPerformerAvg.toFixed(2)}ms)`);
    console.log(`Performance gap: ${results.summary.performanceGap}%`);
    
    // Cleanup connections
    await nativeClient.close();
    await mongoose.disconnect();
    
    console.log('Test complete, results saved to log file');
    
  } catch (error) {
    console.error('Error running performance tests:', error);
  }
}

// Run once immediately
runPerformanceTests();

// Run periodically
if (MONITOR_INTERVAL > 0) {
  console.log(`Scheduling performance monitoring every ${MONITOR_INTERVAL/1000/60} minutes`);
  setInterval(runPerformanceTests, MONITOR_INTERVAL);
} 