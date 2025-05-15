/**
 * MongoDB Cursor Optimization Script
 * 
 * This script implements the best practices for MongoDB cursors based on our performance tests.
 * It directly modifies the /routes/cursores.js file to optimize the cursor implementation.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// File to optimize
const targetFile = path.join(__dirname, 'routes', 'cursores.js');

// Read the current file
console.log(`Reading file: ${targetFile}`);
let fileContent = fs.readFileSync(targetFile, 'utf8');

// Backup the original file
const backupFile = `${targetFile}.backup-${Date.now()}.js`;
console.log(`Creating backup at: ${backupFile}`);
fs.writeFileSync(backupFile, fileContent);

// Optimization 1: Replace the comparar endpoint implementation with optimized version
console.log('Optimizing the /comparar endpoint...');

const oldCompararFunction = `// Comparar rendimiento entre consultas con y sin cursor
router.post('/comparar', async (req, res) => {
  try {
    const { filtro, limite, batchSize } = req.body;
    const queryStats = getQueryStats();
    
    // Validar parámetros
    const limit = parseInt(limite) || 10;
    const cursorBatchSize = parseInt(batchSize) || 100; // Aumentar el tamaño de lote predeterminado
    let filter = {};
    
    // Construir filtro a partir de los parámetros
    if (filtro && filtro.campo && filtro.valor) {
      filter[filtro.campo] = filtro.valor;
    }
    
    // Simular procesamiento intensivo para cada documento
    // Esta función hace más evidente las diferencias de rendimiento entre métodos
    const procesarDocumento = (doc) => {
      // Simulación de procesamiento intensivo por documento
      let result = { ...doc };
      
      // Realizar algunas operaciones costosas
      for (let i = 0; i < 1000; i++) {
        result._simulatedField = Math.sqrt(i) * Math.random();
      }
      
      return result;
    };
    
    // Consulta 1: Usando cursor optimizado correctamente
    const startCursor = performance.now();
    
    // Crear un cursor nativo optimizado
    const collection = mongoose.connection.db.collection('cursors');
    const nativeCursor = collection.find(filter, {
      projection: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 }
    }).limit(limit).sort({ fechaCreacion: -1 }).batchSize(cursorBatchSize);
    
    // OPTIMIZACIÓN: Cargar los documentos usando batchSize pero procesarlos en bloque
    const documents = await nativeCursor.toArray();
    
    // Usar map para procesamiento en bloque (mucho más eficiente para la CPU)
    const processedResultsCursor = documents.map(procesarDocumento);
    
    const endCursor = performance.now();
    const cursorTime = parseFloat((endCursor - startCursor).toFixed(2));
    
    // Consulta 2: Sin usar optimizaciones de cursor
    const startNoCursor = performance.now();
    const resultsNoCursor = await Cursor.find(filter).limit(limit).exec();
    
    // Procesar todos los documentos de una vez (simulando la carga en memoria)
    const processedResultsNoCursor = resultsNoCursor.map(procesarDocumento);
    
    const endNoCursor = performance.now();
    const noCursorTime = parseFloat((endNoCursor - startNoCursor).toFixed(2));
    
    // Consulta 3: Usando agregación para comparación adicional
    const startAggregation = performance.now();
    const resultsAggregation = await Cursor.aggregate([
      { $match: filter },
      { $limit: limit },
      { $sort: { fechaCreacion: -1 } }
    ]);
    
    // Procesar resultados de agregación
    const processedResultsAggregation = resultsAggregation.map(procesarDocumento);
    
    const endAggregation = performance.now();
    const aggregationTime = parseFloat((endAggregation - startAggregation).toFixed(2));
    
    // Consulta 4: Usando agregación con cursor
    const startAggCursor = performance.now();
    
    // Crear un cursor de agregación
    const aggCursor = Cursor.aggregate([
      { $match: filter },
      { $limit: limit },
      { $sort: { fechaCreacion: -1 } }
    ]).cursor();
    
    // OPTIMIZACIÓN: Cargar y procesar en bloque en lugar de usar iteración documento por documento
    const aggDocuments = await aggCursor.toArray();
    const processedResultsAggCursor = aggDocuments.map(procesarDocumento);
    
    const endAggCursor = performance.now();
    const aggCursorTime = parseFloat((endAggCursor - startAggCursor).toFixed(2));`;

const newCompararFunction = `// Comparar rendimiento entre consultas con y sin cursor
router.post('/comparar', async (req, res) => {
  try {
    const { filtro, limite, batchSize } = req.body;
    const queryStats = getQueryStats();
    
    // Validar parámetros
    const limit = parseInt(limite) || 10;
    const cursorBatchSize = parseInt(batchSize) || 500; // Optimizado a 500 basado en pruebas
    let filter = {};
    
    // Construir filtro a partir de los parámetros
    if (filtro && filtro.campo && filtro.valor) {
      filter[filtro.campo] = filtro.valor;
    }
    
    // Simular procesamiento intensivo para cada documento
    // Esta función hace más evidente las diferencias de rendimiento entre métodos
    const procesarDocumento = (doc) => {
      // Simulación de procesamiento intensivo por documento
      let result = { ...doc };
      
      // Realizar algunas operaciones costosas
      for (let i = 0; i < 1000; i++) {
        result._simulatedField = Math.sqrt(i) * Math.random();
      }
      
      return result;
    };
    
    // Consulta 1: Usando driver nativo directamente para mejor rendimiento
    const startCursor = performance.now();
    
    // Usar el cliente nativo en lugar de usar Mongoose
    const collection = mongoose.connection.db.collection('cursors');
    const nativeCursor = collection.find(filter)
      .limit(limit)
      .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
      .sort({ fechaCreacion: -1 })
      .batchSize(cursorBatchSize);
    
    // OPTIMIZACIÓN: toArray es normalmente la operación más eficiente para conjuntos limitados
    const documents = await nativeCursor.toArray();
    const processedResultsCursor = documents.map(procesarDocumento);
    
    const endCursor = performance.now();
    const cursorTime = parseFloat((endCursor - startCursor).toFixed(2));
    
    // Consulta 2: Sin usar optimizaciones de cursor (Mongoose estándar)
    const startNoCursor = performance.now();
    
    // Agregar .lean() para evitar la sobrecarga de instantiación de documentos Mongoose
    const resultsNoCursor = await Cursor.find(filter)
      .limit(limit)
      .select('nombre edad ciudad fechaCreacion')
      .lean()
      .exec();
    
    const processedResultsNoCursor = resultsNoCursor.map(procesarDocumento);
    
    const endNoCursor = performance.now();
    const noCursorTime = parseFloat((endNoCursor - startNoCursor).toFixed(2));
    
    // Consulta 3: Usando agregación para comparación adicional
    const startAggregation = performance.now();
    
    const resultsAggregation = await collection.aggregate([
      { $match: filter },
      { $sort: { fechaCreacion: -1 } },
      { $limit: limit },
      { $project: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 } }
    ]).toArray();
    
    const processedResultsAggregation = resultsAggregation.map(procesarDocumento);
    
    const endAggregation = performance.now();
    const aggregationTime = parseFloat((endAggregation - startAggregation).toFixed(2));
    
    // Consulta 4: Usando cursor nativo de driver (método alternativo)
    const startAggCursor = performance.now();
    
    const cursor = collection.find(filter)
      .limit(limit)
      .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
      .sort({ fechaCreacion: -1 });
    
    // OPTIMIZACIÓN: Usando forEach que tiene mejor rendimiento en algunos casos
    const processedResultsAggCursor = [];
    await cursor.forEach(doc => {
      processedResultsAggCursor.push(procesarDocumento(doc));
    });
    
    const endAggCursor = performance.now();
    const aggCursorTime = parseFloat((endAggCursor - startAggCursor).toFixed(2));`;

// Replace the function implementation
fileContent = fileContent.replace(oldCompararFunction, newCompararFunction);

// Optimization 2: Replace the ejecutar endpoint implementation to use optimized cursor techniques
console.log('Optimizing the /:id/ejecutar endpoint...');

const oldEjecutarFunction = `// Ejecutar un cursor y devolver los resultados
router.get('/:id/ejecutar', async (req, res) => {
  try {
    const cursorId = req.params.id;
    const queryStats = getQueryStats();
    
    // Verificar que el cursor exista
    const cursorExiste = await Cursor.findById(cursorId);
    if (!cursorExiste) {
      return res.status(404).json({ 
        success: false,
        error: 'Cursor no encontrado'
      });
    }
    
    // Métricas iniciales para simulación
    const startTime = performance.now();
    
    // En MongoDB, un cursor no devuelve todos los resultados de inmediato
    // sino que se obtienen en lotes (batch size) según se necesitan
    
    // Acceder directamente a la colección para un rendimiento óptimo
    const collection = mongoose.connection.db.collection('cursors');
    
    // Estimar el tamaño promedio de documento y calcular el batchSize óptimo
    const avgDocSize = await estimateDocumentSize(collection, { ciudad: cursorExiste.ciudad });
    const batchSize = calculateOptimalBatchSize(avgDocSize);
    console.log(\`Tamaño estimado de documento: \${avgDocSize} bytes, batchSize óptimo: \${batchSize}\`);
    
    // Crear un cursor nativo con opciones optimizadas
    const mongoCursor = collection.find({ 
      ciudad: cursorExiste.ciudad
    }, {
      // Proyección para seleccionar solo los campos necesarios
      projection: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 }
    }).batchSize(batchSize);
    
    // Estadísticas del cursor
    let docsExamined = 0;
    let docsReturned = 0;
    let currentBatch = 0;
    
    // Procesamos el cursor en batches para simular uso real
    const cursorResultados = [];
    let batch;
    
    try {
      // Utilizamos el patrón de cursor óptimo: iterar en batches
      while (await mongoCursor.hasNext()) {
        try {
          batch = await mongoCursor.next();
          cursorResultados.push(batch);
          docsReturned++;
          
          // Incrementamos el número de lotes procesados
          if (docsReturned % batchSize === 1) {
            currentBatch++;
          }
          
          // Limitamos a 100 documentos para la demostración
          if (docsReturned >= 100) break;
        } catch (error) {
          if (error.code === 43) { // CursorNotFound error
            console.error("Cursor expirado. Reiniciando operación...");
            // Recreamos el cursor y continuamos desde donde nos quedamos
            mongoCursor = collection.find({ 
              ciudad: cursorExiste.ciudad
            }, {
              projection: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 }
            }).batchSize(batchSize).skip(docsReturned);
          } else {
            throw error; // Otro tipo de error, lo propagamos
          }
        }
      }
    } finally {
      // Aseguramos que el cursor se cierre siempre
      await mongoCursor.close();
    }`;

const newEjecutarFunction = `// Ejecutar un cursor y devolver los resultados
router.get('/:id/ejecutar', async (req, res) => {
  try {
    const cursorId = req.params.id;
    const queryStats = getQueryStats();
    
    // Verificar que el cursor exista
    const cursorExiste = await Cursor.findById(cursorId).lean(); // Usar lean() para mejor rendimiento
    if (!cursorExiste) {
      return res.status(404).json({ 
        success: false,
        error: 'Cursor no encontrado'
      });
    }
    
    // Métricas iniciales para simulación
    const startTime = performance.now();
    
    // En MongoDB, un cursor no devuelve todos los resultados de inmediato
    // sino que se obtienen en lotes (batch size) según se necesitan
    
    // Acceder directamente a la colección para un rendimiento óptimo
    const collection = mongoose.connection.db.collection('cursors');
    
    // Para conjuntos pequeños/medianos, el batchSize óptimo está entre 500-1000
    // Basado en nuestras pruebas de rendimiento
    const batchSize = 500;
    
    // Crear un cursor nativo con opciones optimizadas
    const mongoCursor = collection.find({ 
      ciudad: cursorExiste.ciudad
    }).project({ 
      nombre: 1, 
      edad: 1, 
      ciudad: 1, 
      fechaCreacion: 1 
    }).limit(100) // Limitar a 100 documentos para la demostración
      .batchSize(batchSize);
    
    // Estadísticas del cursor
    let docsReturned = 0;
    let currentBatch = 1;  // Empezamos con un batch
    
    // OPTIMIZACIÓN: Para conjuntos pequeños/medianos (<100K docs), toArray() es más eficiente
    // que iterar uno por uno, especialmente cuando procesamos todos los documentos
    const cursorResultados = await mongoCursor.toArray();
    docsReturned = cursorResultados.length;
    
    // Simular el cálculo de batches
    currentBatch = Math.ceil(docsReturned / batchSize);`;

// Replace the function implementation
fileContent = fileContent.replace(oldEjecutarFunction, newEjecutarFunction);

// Optimization 3: Update the calculateOptimalBatchSize function
console.log('Optimizing the batch size calculation...');

const oldBatchSizeFunction = `// Función para calcular el tamaño de batch óptimo basado en el tamaño de documento
function calculateOptimalBatchSize(avgDocSizeBytes = 1024, memoryLimitBytes = 16777216) { // 16MB por defecto (límite BSON)
  // Añadimos un margen de seguridad del 20%
  const estimatedBatchSize = Math.floor(memoryLimitBytes / (avgDocSizeBytes * 1.2));
  
  // Limitamos entre 10 y 1000 documentos por batch
  return Math.min(Math.max(estimatedBatchSize, 10), 1000);
}`;

const newBatchSizeFunction = `// Función para calcular el tamaño de batch óptimo basado en el tamaño de documento
function calculateOptimalBatchSize(avgDocSizeBytes = 1024, memoryLimitBytes = 16777216) { // 16MB por defecto (límite BSON)
  // Basado en nuestras pruebas, para conjuntos de documentos pequeños/medianos, batchSize=500 proporciona
  // el mejor equilibrio entre rendimiento y uso de recursos
  
  // Para documentos muy grandes, calculamos un tamaño óptimo
  if (avgDocSizeBytes > 10000) {
    // Añadimos un margen de seguridad del 20%
    const estimatedBatchSize = Math.floor(memoryLimitBytes / (avgDocSizeBytes * 1.2));
    return Math.min(Math.max(estimatedBatchSize, 10), 500);  // Cambiamos máximo a 500 basado en pruebas
  }
  
  // Para documentos de tamaño normal, usamos 500 como valor por defecto
  return 500;
}`;

// Replace the function
fileContent = fileContent.replace(oldBatchSizeFunction, newBatchSizeFunction);

// Write the optimized file
console.log('Writing optimized file...');
fs.writeFileSync(targetFile, fileContent);

console.log('Done! The file has been optimized based on performance test results.');
console.log(`Original file backed up to: ${backupFile}`);

// Additional notes for reference
console.log('\nOptimization Notes:');
console.log('1. Changed default batchSize to 500 based on performance tests');
console.log('2. Using native MongoDB driver directly for best performance');
console.log('3. Added .lean() to Mongoose queries to avoid document instantiation overhead');
console.log('4. Using toArray() rather than iterating document by document for small/medium result sets');
console.log('5. Using forEach() method for alternative cursor iteration approach'); 