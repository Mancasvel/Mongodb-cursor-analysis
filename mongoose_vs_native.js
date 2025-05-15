require('dotenv').config();
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const { performance } = require('perf_hooks');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
const COLLECTION_NAME = 'cursors';
const TEST_ITERATIONS = 5;
const DOCUMENT_LIMIT = 100;

// Simulate intensive document processing
const processDocument = (doc) => {
  let result = { ...doc };
  for (let i = 0; i < 1000; i++) {
    result._simulatedField = Math.sqrt(i) * Math.random();
  }
  return result;
};

// Create Mongoose model
const cursorSchema = new mongoose.Schema({
  nombre: String,
  edad: Number,
  ciudad: String,
  fechaCreacion: { type: Date, default: Date.now }
});

async function runTests() {
  console.log('Mongoose vs Native Driver Performance Test');
  console.log('========================================\n');
  console.log(`Connection: ${MONGODB_URI}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Iterations: ${TEST_ITERATIONS}`);
  console.log(`Document limit: ${DOCUMENT_LIMIT}\n`);
  
  // Connect native client
  const nativeClient = new MongoClient(MONGODB_URI);
  await nativeClient.connect();
  console.log('Connected to MongoDB with native driver');
  
  const db = nativeClient.db();
  const nativeCollection = db.collection(COLLECTION_NAME);
  
  // Connect mongoose
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB with Mongoose');
  
  const CursorModel = mongoose.model('Cursor', cursorSchema);
  
  try {
    // Count documents
    const count = await nativeCollection.countDocuments();
    console.log(`Collection contains ${count} documents\n`);
    
    // Test 1: Native driver with find + toArray
    const nativeResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const documents = await nativeCollection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .toArray();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      nativeResults.push(time);
      
      console.log(`Test 1 (Native driver): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 2: Mongoose find (with document instantiation)
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
      
      console.log(`Test 2 (Mongoose): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 3: Mongoose find with lean() option
    const mongooseLeanResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      const documents = await CursorModel.find({})
        .limit(DOCUMENT_LIMIT)
        .select('nombre edad ciudad fechaCreacion')
        .sort({ fechaCreacion: -1 })
        .lean()  // This returns plain JavaScript objects
        .exec();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      mongooseLeanResults.push(time);
      
      console.log(`Test 3 (Mongoose with lean): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Test 4: Mongoose with native cursor
    const mongooseNativeCursorResults = [];
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      
      // Get the native collection through mongoose
      const collection = mongoose.connection.db.collection(COLLECTION_NAME);
      
      const documents = await collection.find({})
        .limit(DOCUMENT_LIMIT)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .toArray();
      
      const processed = documents.map(processDocument);
      
      const end = performance.now();
      const time = parseFloat((end - start).toFixed(2));
      mongooseNativeCursorResults.push(time);
      
      console.log(`Test 4 (Mongoose with native cursor): Iteration ${i+1}: ${time}ms, ${processed.length} docs`);
    }
    
    // Calculate and show averages
    const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    console.log('\n=== RESULTS ===');
    console.log(`Native driver: ${average(nativeResults).toFixed(2)}ms`);
    console.log(`Mongoose: ${average(mongooseResults).toFixed(2)}ms`);
    console.log(`Mongoose with lean: ${average(mongooseLeanResults).toFixed(2)}ms`);
    console.log(`Mongoose with native cursor: ${average(mongooseNativeCursorResults).toFixed(2)}ms`);
    
    // Calculate percentage differences
    const nativeAvg = average(nativeResults);
    console.log('\n=== COMPARISON (vs Native Driver) ===');
    console.log(`Mongoose is ${((average(mongooseResults) - nativeAvg) / nativeAvg * 100).toFixed(2)}% slower`);
    console.log(`Mongoose with lean is ${((average(mongooseLeanResults) - nativeAvg) / nativeAvg * 100).toFixed(2)}% slower`);
    console.log(`Mongoose with native cursor is ${((average(mongooseNativeCursorResults) - nativeAvg) / nativeAvg * 100).toFixed(2)}% slower`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await nativeClient.close();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

runTests().catch(console.error); 