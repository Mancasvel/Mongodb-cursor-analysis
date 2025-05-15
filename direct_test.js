/**
 * Direct MongoDB cursor performance test
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const { performance } = require('perf_hooks');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
const COLLECTION_NAME = 'cursors';
const TEST_ITERATIONS = 5;
const TEST_LIMITS = [100, 1000];

// Schema for Mongoose
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

async function runTests() {
  console.log('Direct MongoDB Cursor Performance Test');
  console.log('=====================================\n');
  
  try {
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB with native driver');
    
    // Connect with Mongoose
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB with Mongoose');
    
    const CursorModel = mongoose.model('Cursor', cursorSchema);
    const collection = client.db().collection(COLLECTION_NAME);
    
    // Count total documents
    const totalDocs = await collection.countDocuments();
    console.log(`Collection contains ${totalDocs} documents\n`);
    
    // Store results for all limits and methods
    const results = {};
    
    for (const limit of TEST_LIMITS) {
      results[limit] = {
        direct: [],
        aggregation: [],
        cursor: [],
        nativeCursor: []
      };
      
      console.log(`\nTesting with limit=${limit}...`);
      
      // Run multiple iterations for more accurate results
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        console.log(`\nIteration ${i + 1}:`);
        
        // Test 1: Direct query with Mongoose + lean()
        const startDirect = performance.now();
        const resultsDirect = await CursorModel.find({})
          .limit(limit)
          .select('nombre edad ciudad fechaCreacion')
          .lean()
          .exec();
        const processedDirect = resultsDirect.map(processDocument);
        const endDirect = performance.now();
        const timeDirect = parseFloat((endDirect - startDirect).toFixed(2));
        results[limit].direct.push(timeDirect);
        console.log(`1. Direct Query (Mongoose+lean): ${timeDirect}ms, ${processedDirect.length} docs`);
        
        // Test 2: Aggregation pipeline
        const startAgg = performance.now();
        const resultsAgg = await collection.aggregate([
          { $match: {} },
          { $sort: { fechaCreacion: -1 } },
          { $limit: limit },
          { $project: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 } }
        ]).toArray();
        const processedAgg = resultsAgg.map(processDocument);
        const endAgg = performance.now();
        const timeAgg = parseFloat((endAgg - startAgg).toFixed(2));
        results[limit].aggregation.push(timeAgg);
        console.log(`2. Aggregation Pipeline: ${timeAgg}ms, ${processedAgg.length} docs`);
        
        // Test 3: Optimized cursor with toArray
        const startCursor = performance.now();
        const cursor = collection.find({})
          .limit(limit)
          .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
          .sort({ fechaCreacion: -1 })
          .batchSize(500);
        const resultsCursor = await cursor.toArray();
        const processedCursor = resultsCursor.map(processDocument);
        const endCursor = performance.now();
        const timeCursor = parseFloat((endCursor - startCursor).toFixed(2));
        results[limit].cursor.push(timeCursor);
        console.log(`3. Native cursor + toArray: ${timeCursor}ms, ${processedCursor.length} docs`);
        
        // Test 4: Native cursor with forEach
        const startForEach = performance.now();
        const cursorForEach = collection.find({})
          .limit(limit)
          .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
          .sort({ fechaCreacion: -1 })
          .batchSize(500);
        const processedForEach = [];
        await cursorForEach.forEach(doc => {
          processedForEach.push(processDocument(doc));
        });
        const endForEach = performance.now();
        const timeForEach = parseFloat((endForEach - startForEach).toFixed(2));
        results[limit].nativeCursor.push(timeForEach);
        console.log(`4. Native cursor + forEach: ${timeForEach}ms, ${processedForEach.length} docs`);
      }
      
      // Calculate and display averages for this limit
      const avgDirect = results[limit].direct.reduce((a, b) => a + b, 0) / TEST_ITERATIONS;
      const avgAgg = results[limit].aggregation.reduce((a, b) => a + b, 0) / TEST_ITERATIONS;
      const avgCursor = results[limit].cursor.reduce((a, b) => a + b, 0) / TEST_ITERATIONS;
      const avgForEach = results[limit].nativeCursor.reduce((a, b) => a + b, 0) / TEST_ITERATIONS;
      
      console.log(`\nAverage results for limit=${limit}:`);
      console.log(`1. Direct Query (Mongoose+lean): ${avgDirect.toFixed(2)}ms`);
      console.log(`2. Aggregation Pipeline: ${avgAgg.toFixed(2)}ms`);
      console.log(`3. Native cursor + toArray: ${avgCursor.toFixed(2)}ms`);
      console.log(`4. Native cursor + forEach: ${avgForEach.toFixed(2)}ms`);
      
      // Find fastest method
      const methods = [
        { name: 'Direct Query (Mongoose+lean)', time: avgDirect },
        { name: 'Aggregation Pipeline', time: avgAgg },
        { name: 'Native cursor + toArray', time: avgCursor },
        { name: 'Native cursor + forEach', time: avgForEach }
      ];
      methods.sort((a, b) => a.time - b.time);
      
      const fastestMethod = methods[0];
      const cursorVsFastest = ((avgCursor - fastestMethod.time) / fastestMethod.time * 100).toFixed(2);
      
      console.log(`\nFastest method: ${fastestMethod.name} (${fastestMethod.time.toFixed(2)}ms)`);
      console.log(`Native cursor overhead vs fastest: ${cursorVsFastest}%`);
      
      console.log('\nPerformance ranking:');
      methods.forEach((method, idx) => {
        console.log(`${idx + 1}. ${method.name}: ${method.time.toFixed(2)}ms`);
      });
    }
    
    // Close connections
    await client.close();
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests().catch(console.error); 