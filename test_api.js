/**
 * Test script for the optimized /cursores/comparar endpoint
 */
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000/cursores/comparar';
const TEST_ITERATIONS = 3;
const TEST_PARAMS = [
  { limite: 100, batchSize: 500 },
  { limite: 1000, batchSize: 500 }
];

async function runTest() {
  console.log('Testing optimized /cursores/comparar endpoint');
  console.log('==========================================\n');
  
  for (const params of TEST_PARAMS) {
    console.log(`\nRunning test with limit=${params.limite}, batchSize=${params.batchSize}...`);
    
    const results = [];
    
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      console.log(`\nIteration ${i + 1}:`);
      
      try {
        const response = await axios.post(API_URL, params);
        const data = response.data;
        
        if (data.success) {
          results.push({
            conCursor: data.resultados.conCursor.tiempo,
            sinCursor: data.resultados.sinCursor.tiempo,
            agregacion: data.resultados.agregacion.tiempo,
            cursorNativo: data.resultados.cursorNativo.tiempo,
            fastestMethod: data.comparacion.metodaMasRapido,
            diff: data.comparacion.diferenciaPorcentaje
          });
          
          // Print results for this iteration
          console.log(`Con Cursor (toArray): ${data.resultados.conCursor.tiempo} ms`);
          console.log(`Sin Cursor (Mongoose): ${data.resultados.sinCursor.tiempo} ms`);
          console.log(`Agregación: ${data.resultados.agregacion.tiempo} ms`);
          console.log(`Cursor Nativo (forEach): ${data.resultados.cursorNativo.tiempo} ms`);
          console.log(`Método más rápido: ${data.comparacion.metodaMasRapido} (diferencia: ${data.comparacion.diferenciaPorcentaje}%)`);
        } else {
          console.error('API error:', data.error);
        }
      } catch (error) {
        console.error('Error during API call:', error.message);
      }
    }
    
    // Calculate and display averages
    if (results.length > 0) {
      const avgConCursor = results.reduce((sum, r) => sum + r.conCursor, 0) / results.length;
      const avgSinCursor = results.reduce((sum, r) => sum + r.sinCursor, 0) / results.length;
      const avgAgregacion = results.reduce((sum, r) => sum + r.agregacion, 0) / results.length;
      const avgCursorNativo = results.reduce((sum, r) => sum + r.cursorNativo, 0) / results.length;
      
      console.log(`\n=== AVERAGE RESULTS (${results.length} iterations) ===`);
      console.log(`Con Cursor (toArray): ${avgConCursor.toFixed(2)} ms`);
      console.log(`Sin Cursor (Mongoose): ${avgSinCursor.toFixed(2)} ms`);
      console.log(`Agregación: ${avgAgregacion.toFixed(2)} ms`);
      console.log(`Cursor Nativo (forEach): ${avgCursorNativo.toFixed(2)} ms`);
      
      // Find the fastest method on average
      const methods = [
        { name: 'Con Cursor (toArray)', time: avgConCursor },
        { name: 'Sin Cursor (Mongoose)', time: avgSinCursor },
        { name: 'Agregación', time: avgAgregacion },
        { name: 'Cursor Nativo (forEach)', time: avgCursorNativo }
      ];
      methods.sort((a, b) => a.time - b.time);
      
      console.log(`\nFastest method: ${methods[0].name} (${methods[0].time.toFixed(2)} ms)`);
      console.log('\nPerformance ranking:');
      methods.forEach((method, idx) => {
        const percentSlower = idx === 0 ? 0 : ((method.time - methods[0].time) / methods[0].time * 100).toFixed(2);
        console.log(`${idx + 1}. ${method.name}: ${method.time.toFixed(2)} ms ${idx > 0 ? '(+' + percentSlower + '%)' : ''}`);
      });
    }
  }
}

// Run the tests
runTest().catch(console.error); 