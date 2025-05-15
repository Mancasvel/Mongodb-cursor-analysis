require('dotenv').config();
const { MongoClient } = require('mongodb');
const { performance } = require('perf_hooks');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
const COLLECTION_NAME = 'cursors';
const TEST_ITERATIONS = 5;
const DOCUMENT_LIMIT = 100;

// Connect to MongoDB
async function runTests() {
  console.log('MongoDB Native Driver Performance Test');
  console.log('=====================================\n');
  console.log(`Connection: ${MONGODB_URI}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Iterations: ${TEST_ITERATIONS}`);
  console.log(`Document limit: ${DOCUMENT_LIMIT}\n`);

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection(COLLECTION_NAME);
    
    // Count documents to understand dataset size
    const count = await collection.countDocuments();
    console.log(`Collection contains ${count} documents\n`);
    
    // Simulate intensive document processing
    const processDocument = (doc) => {
      let result = { ...doc };
      for (let i = 0; i < 1000; i++) {
        result._simulatedField = Math.sqrt(i) * Math.random();
      }
      return result;
    };
    
    // Test 1: Native cursor with .toArray() + .map()
    const nativeCursorResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 });
      
      const documents = await cursor.toArray();
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      nativeCursorResults.push(time);
      
      console.log(`Test 1 (Native cursor + toArray): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 2: Native cursor with for-await loop
    const forAwaitResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const cursor = collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 });
      
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
      
      console.log(`Test 2 (Native cursor + for-await): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 3: .toArray() with different batch sizes
    const batchSizes = [10, 100, 500, 1000];
    const batchSizeResults = {};
    
    for (const batchSize of batchSizes) {
      batchSizeResults[batchSize] = [];
      
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        const start = performance.now();
        
        const cursor = collection.find({})
          .limit(DOCUMENT_LIMIT)
          .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
          .sort({ fechaCreacion: -1 })
          .batchSize(batchSize);
        
        const documents = await cursor.toArray();
        const processed = documents.map(processDocument);
        
        const end = performance.now();
        const time = parseFloat((end - start).toFixed(2));
        batchSizeResults[batchSize].push(time);
        
        console.log(`Test 3 (batchSize=${batchSize}): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
      }
    }
    
    // Test 4: Direct aggregate with $match + $limit
    const aggregateResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const documents = await collection.aggregate([
        { $match: {} },
        { $sort: { fechaCreacion: -1 } },
        { $limit: DOCUMENT_LIMIT },
        { $project: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 } }
      ]).toArray();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      aggregateResults.push(time);
      
      console.log(`Test 4 (Direct aggregate): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Calculate and show averages
    const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    console.log('\n=== RESULTS ===');
    console.log(`Native cursor + toArray: ${average(nativeCursorResults).toFixed(2)}ms`);
    console.log(`Native cursor + for-await: ${average(forAwaitResults).toFixed(2)}ms`);
    
    for (const batchSize of batchSizes) {
      console.log(`Native cursor + batchSize ${batchSize}: ${average(batchSizeResults[batchSize]).toFixed(2)}ms`);
    }
    
    console.log(`Direct aggregate: ${average(aggregateResults).toFixed(2)}ms`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

runTests().catch(console.error); 