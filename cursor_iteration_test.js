require('dotenv').config();
const { MongoClient } = require('mongodb');
const { performance } = require('perf_hooks');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
const COLLECTION_NAME = 'cursors';
const TEST_ITERATIONS = 5;
const DOCUMENT_LIMIT = 100;
const BATCH_SIZE = 20; // Default batch size for tests

// Simulate intensive document processing
const processDocument = (doc) => {
  let result = { ...doc };
  for (let i = 0; i < 1000; i++) {
    result._simulatedField = Math.sqrt(i) * Math.random();
  }
  return result;
};

async function runTests() {
  console.log('MongoDB Cursor Iteration Performance Test');
  console.log('========================================\n');
  console.log(`Connection: ${MONGODB_URI}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Iterations: ${TEST_ITERATIONS}`);
  console.log(`Document limit: ${DOCUMENT_LIMIT}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection(COLLECTION_NAME);
    
    // Count documents
    const count = await collection.countDocuments();
    console.log(`Collection contains ${count} documents\n`);
    
    // Test 1: toArray() + map()
    const toArrayResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(BATCH_SIZE);
      
      const documents = await cursor.toArray();
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      toArrayResults.push(time);
      
      console.log(`Test 1 (toArray + map): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 2: for-await loop
    const forAwaitResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(BATCH_SIZE);
      
      const processed = [];
      try {
        for await (const doc of cursor) {
          processed.push(processDocument(doc));
        }
      } finally {
        await cursor.close();
      }
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      forAwaitResults.push(time);
      
      console.log(`Test 2 (for-await): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 3: Manual iteration with hasNext/next
    const manualIterationResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(BATCH_SIZE);
      
      const processed = [];
      try {
        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          processed.push(processDocument(doc));
        }
      } finally {
        await cursor.close();
      }
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      manualIterationResults.push(time);
      
      console.log(`Test 3 (manual hasNext/next): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 4: forEach method
    const forEachResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(BATCH_SIZE);
      
      const processed = [];
      await cursor.forEach(doc => {
        processed.push(processDocument(doc));
      });
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      forEachResults.push(time);
      
      console.log(`Test 4 (forEach): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 5: batch processing (manual batching)
    const batchProcessingResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .batchSize(BATCH_SIZE);
      
      const processed = [];
      let batch = [];
      let batchCount = 0;
      
      try {
        while (await cursor.hasNext()) {
          batch.push(await cursor.next());
          
          // Process in batches
          if (batch.length >= BATCH_SIZE || !(await cursor.hasNext())) {
            const processedBatch = batch.map(processDocument);
            processed.push(...processedBatch);
            batch = [];
            batchCount++;
          }
        }
      } finally {
        await cursor.close();
      }
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      batchProcessingResults.push(time);
      
      console.log(`Test 5 (batch processing): Iteration ${i+1}: ${time}ms, ${processed.length} docs, ${batchCount} batches`);
    }
    
    // Calculate and display averages
    const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    console.log('\n=== RESULTS ===');
    console.log(`toArray + map: ${average(toArrayResults).toFixed(2)}ms`);
    console.log(`for-await: ${average(forAwaitResults).toFixed(2)}ms`);
    console.log(`manual hasNext/next: ${average(manualIterationResults).toFixed(2)}ms`);
    console.log(`forEach: ${average(forEachResults).toFixed(2)}ms`);
    console.log(`batch processing: ${average(batchProcessingResults).toFixed(2)}ms`);
    
    // Compare with toArray as baseline
    const toArrayAvg = average(toArrayResults);
    console.log('\n=== COMPARISON (vs toArray + map) ===');
    console.log(`for-await is ${((average(forAwaitResults) - toArrayAvg) / toArrayAvg * 100).toFixed(2)}% ${average(forAwaitResults) > toArrayAvg ? 'slower' : 'faster'}`);
    console.log(`manual hasNext/next is ${((average(manualIterationResults) - toArrayAvg) / toArrayAvg * 100).toFixed(2)}% ${average(manualIterationResults) > toArrayAvg ? 'slower' : 'faster'}`);
    console.log(`forEach is ${((average(forEachResults) - toArrayAvg) / toArrayAvg * 100).toFixed(2)}% ${average(forEachResults) > toArrayAvg ? 'slower' : 'faster'}`);
    console.log(`batch processing is ${((average(batchProcessingResults) - toArrayAvg) / toArrayAvg * 100).toFixed(2)}% ${average(batchProcessingResults) > toArrayAvg ? 'slower' : 'faster'}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

runTests().catch(console.error); 