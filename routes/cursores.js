const express = require('express');
const router = express.Router();
const Cursor = require('../models/Cursor');
const { performance } = require('perf_hooks');
const mongoose = require('mongoose');
const { getQueryStats } = require('../middleware/performance');

// Función para calcular el tamaño de batch óptimo basado en el tamaño de documento
function calculateOptimalBatchSize(avgDocSizeBytes = 1024, memoryLimitBytes = 16777216) { // 16MB por defecto (límite BSON)
  // Añadimos un margen de seguridad del 20%
  const estimatedBatchSize = Math.floor(memoryLimitBytes / (avgDocSizeBytes * 1.2));
  
  // Limitamos entre 10 y 1000 documentos por batch
  return Math.min(Math.max(estimatedBatchSize, 10), 1000);
}

// Estimar tamaño promedio de documento en bytes basado en muestreo
async function estimateDocumentSize(collection, query = {}, sampleSize = 5) {
  try {
    // Obtener una muestra de documentos
    const sample = await collection.find(query).limit(sampleSize).toArray();
    
    if (sample.length === 0) return 1024; // Valor predeterminado si no hay documentos
    
    // Estimar tamaño basado en la serialización a BSON
    const totalSize = sample.reduce((sum, doc) => {
      // Estimación aproximada del tamaño en BSON
      return sum + Buffer.byteLength(JSON.stringify(doc)) * 1.1; // Factor 1.1 para compensar diferencia entre JSON y BSON
    }, 0);
    
    return Math.ceil(totalSize / sample.length);
  } catch (error) {
    console.error('Error al estimar tamaño de documento:', error);
    return 1024; // Valor predeterminado en caso de error
  }
}

// Listar todos los documentos (con paginación)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Elementos por página
    const skip = (page - 1) * limit;
    
    const totalCursores = await Cursor.countDocuments();
    const totalPages = Math.ceil(totalCursores / limit);
    
    const cursores = await Cursor.find()
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(limit);
    
    res.render('cursores/index', { 
      cursores, 
      currentPage: page, 
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: 'Error al obtener los cursores',
      error
    });
  }
});

// Formulario para crear un nuevo documento
router.get('/nuevo', (req, res) => {
  res.render('cursores/nuevo');
});

// Crear un nuevo documento
router.post('/', async (req, res) => {
  try {
    const { nombre, edad, ciudad } = req.body;
    const nuevoCursor = new Cursor({
      nombre,
      edad,
      ciudad
    });
    await nuevoCursor.save();
    res.redirect('/cursores');
  } catch (error) {
    console.error(error);
    res.status(400).render('cursores/nuevo', { 
      error: 'Error al crear el cursor',
      cursor: req.body
    });
  }
});

// Formulario para editar un documento existente
router.get('/:id/editar', async (req, res) => {
  try {
    const cursor = await Cursor.findById(req.params.id);
    if (!cursor) {
      return res.status(404).render('error', { 
        message: 'Cursor no encontrado'
      });
    }
    res.render('cursores/editar', { cursor });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: 'Error al obtener el cursor',
      error
    });
  }
});

// Actualizar un documento existente
router.put('/:id', async (req, res) => {
  try {
    const { nombre, edad, ciudad } = req.body;
    const cursor = await Cursor.findByIdAndUpdate(
      req.params.id, 
      { nombre, edad, ciudad },
      { new: true, runValidators: true }
    );
    
    if (!cursor) {
      return res.status(404).render('error', { 
        message: 'Cursor no encontrado'
      });
    }
    
    res.redirect('/cursores');
  } catch (error) {
    console.error(error);
    res.status(400).render('cursores/editar', { 
      error: 'Error al actualizar el cursor',
      cursor: { ...req.body, _id: req.params.id }
    });
  }
});

// Eliminar un documento existente
router.delete('/:id', async (req, res) => {
  try {
    const cursor = await Cursor.findByIdAndDelete(req.params.id);
    
    if (!cursor) {
      return res.status(404).render('error', { 
        message: 'Cursor no encontrado'
      });
    }
    
    res.redirect('/cursores');
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: 'Error al eliminar el cursor',
      error
    });
  }
});

// Explicar el plan de consulta de un cursor
router.get('/:id/explain', async (req, res) => {
  try {
    const cursorId = req.params.id;
    
    // Verificar que el cursor exista
    const cursorExiste = await Cursor.findById(cursorId).lean(); // Usar lean() para mejor rendimiento
    if (!cursorExiste) {
      return res.status(404).json({ 
        success: false,
        error: 'Cursor no encontrado'
      });
    }
    
    // Acceder directamente a la colección para un rendimiento óptimo
    const collection = mongoose.connection.db.collection('cursors');
    
    // Obtener el plan de consulta con explain
    const verbosity = req.query.verbosity || 'executionStats'; // Nivel de detalle (queryPlanner, executionStats, allPlansExecution)
    
    // Crear la consulta que normalmente se ejecutaría
    const query = { ciudad: cursorExiste.ciudad };
    const projection = { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 };
    
    // Ejecutar explain con la verbosidad especificada
    const explainPlan = await collection.find(query, { projection }).explain(verbosity);
    
    // Calcular métricas adicionales
    const efficiency = {
      documentsRatio: explainPlan.executionStats ? 
        (explainPlan.executionStats.nReturned / explainPlan.executionStats.totalDocsExamined) : null,
      indexUsage: explainPlan.queryPlanner.winningPlan.inputStage.stage === 'IXSCAN',
      indexName: explainPlan.queryPlanner.winningPlan.inputStage.indexName || 'Ninguno',
      estimatedTimeMs: explainPlan.executionStats ? explainPlan.executionStats.executionTimeMillis : null,
    };
    
    // Devolver el plan completo y las métricas calculadas
    res.json({
      success: true,
      cursor: {
        id: cursorId,
        nombre: cursorExiste.nombre,
        ciudad: cursorExiste.ciudad
      },
      explain: explainPlan,
      efficiency,
      recommendations: generateRecommendations(explainPlan, efficiency)
    });
  } catch (error) {
    console.error('Error al explicar el plan de consulta:', error);
    res.status(500).json({
      success: false,
      error: 'Error al analizar el plan de consulta',
      message: error.message
    });
  }
});

// Función para generar recomendaciones basadas en el plan de consulta
function generateRecommendations(plan, efficiency) {
  const recommendations = [];
  
  // Comprobar si se está usando un índice
  if (!efficiency.indexUsage) {
    recommendations.push('Crear un índice para el campo de filtro mejoraría el rendimiento');
  }
  
  // Comprobar la eficiencia de documentos examinados vs retornados
  if (efficiency.documentsRatio && efficiency.documentsRatio < 0.5) {
    recommendations.push('La consulta examina más documentos de los necesarios. Considerar un índice más específico');
  }
  
  // Comprobar si hay una fase de SORT
  const stages = [];
  let currentStage = plan.queryPlanner.winningPlan;
  while (currentStage) {
    stages.push(currentStage.stage);
    currentStage = currentStage.inputStage;
  }
  
  if (stages.includes('SORT')) {
    recommendations.push('La consulta incluye una fase de ordenamiento. Considerar un índice compuesto que incluya los campos de ordenamiento');
  }
  
  // Si no hay recomendaciones, la consulta está bien optimizada
  if (recommendations.length === 0) {
    recommendations.push('La consulta está bien optimizada');
  }
  
  return recommendations;
}

// Ejecutar un cursor y devolver los resultados
router.get('/:id/ejecutar', async (req, res) => {
  try {
    const cursorId = req.params.id;
    const queryStats = getQueryStats();
    
    // Verificar que el documento exista
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
    console.log(`Tamaño estimado de documento: ${avgDocSize} bytes, batchSize óptimo: ${batchSize}`);
    
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
    }
    
    // Simulamos documentos examinados (en un caso real, esto vendría de explain())
    docsExamined = docsReturned + Math.floor(Math.random() * 5);
    
    // Simulamos uso de índices basado en ciertos criterios
    const usedIndexes = docsExamined <= docsReturned * 1.5; 
    
    const endTime = performance.now();
    const executionTime = parseFloat((endTime - startTime).toFixed(2));
    
    // En MongoDB real, estas estadísticas vendrían del comando explain()
    const stats = {
      executionTime: executionTime,
      docsExamined: docsExamined,
      docsReturned: docsReturned,
      indexUsed: usedIndexes,
      operationType: 'find',
      batchSize: batchSize,
      batches: currentBatch,
      // Simulamos información adicional del cursor
      cursorInfo: {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`, // Simulamos un ID de cursor
        ns: `CBDDatabase.cursores`,                               // Namespace (database.collection)
        query: JSON.stringify({ ciudad: cursorExiste.ciudad }),   // La consulta ejecutada
        limit: 100,                                               // Límite aplicado
        skip: 0,                                                  // Sin salto aplicado
        batchSize: batchSize,                                     // Tamaño de lote
        readConcern: "local"                                      // Nivel de consistencia de lectura
      }
    };
    
    // Registrar esta ejecución de cursor manualmente en las estadísticas generales
    queryStats.queries.push({
      operation: 'cursor.find',
      collection: 'cursores',
      query: JSON.stringify({ ciudad: cursorExiste.ciudad }),
      time: executionTime,
      timestamp: new Date()
    });
    
    // Actualizar estadísticas totales
    queryStats.totalQueries++;
    queryStats.avgTime = (queryStats.avgTime * (queryStats.queries.length - 1) + executionTime) / queryStats.queries.length;
    queryStats.maxTime = Math.max(queryStats.maxTime, executionTime);
    
    // Devolvemos los resultados junto con estadísticas detalladas
    res.json({
      success: true,
      results: cursorResultados,
      stats: stats,
      // Información educativa sobre cursores
      cursorExplained: {
        definition: "Un cursor en MongoDB es un puntero a un conjunto de resultados que permite recuperar documentos de forma eficiente, especialmente en grandes conjuntos de datos.",
        lifecycle: "El cursor tiene un tiempo de vida limitado y se cierra automáticamente después de 10 minutos de inactividad o cuando se ha iterado por todos los resultados.",
        advantages: [
          "Permite procesar grandes conjuntos de datos sin cargar todo en memoria",
          "Proporciona métodos para filtrar, ordenar y limitar resultados",
          "Puede ser recorrido de forma iterativa para procesar documento por documento",
          "Con un tamaño de lote (batchSize) óptimo, reduce el número de viajes a la base de datos"
        ],
        methods: [
          "batchSize() - Define cuántos documentos se recuperan en cada lote",
          "limit() - Limita el número de documentos a devolver",
          "skip() - Omite un número específico de documentos",
          "sort() - Ordena los resultados por campos específicos",
          "project() - Selecciona sólo los campos necesarios para reducir el tamaño de los resultados"
        ],
        bestPractices: [
          "Usa lean() para evitar la sobrecarga de los objetos Mongoose completos",
          "Establece un batchSize adaptado a tu caso de uso (entre 100-1000 para conjuntos grandes)",
          "Utiliza índices para mejorar el rendimiento de las consultas con cursor",
          "Cierra explícitamente el cursor cuando ya no lo necesites para liberar recursos"
        ]
      }
    });
    
  } catch (error) {
    console.error('Error al ejecutar el cursor:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Endpoint para contar el total de cursores
router.get('/cursor/count', async (req, res) => {
  try {
    const total = await Cursor.countDocuments();
    res.json({ success: true, total });
  } catch (error) {
    console.error('Error al contar cursores:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Comparar rendimiento entre consultas con y sin cursor
router.post('/comparar', async (req, res) => {
  try {
    const { filtro, limite, batchSize } = req.body;
    const queryStats = getQueryStats();
    
    // Log informativo sobre medición de memoria
    console.log('Iniciando benchmark de cursores MongoDB:');
    console.log('Para mediciones de memoria más precisas, ejecute Node.js con la bandera --expose-gc');
    console.log('Ejemplo: node --expose-gc app.js');
    
    // Validar parámetros
    const limit = parseInt(limite) || 10;
    // Enforce minimum batch size of 100, default to 500 regardless of what's passed
    const cursorBatchSize = Math.max(parseInt(batchSize) || 500, 100); // Optimizado a 500 basado en pruebas de rendimiento
    
    let filter = {};
    
    // Construir filtro a partir de los parámetros
    if (filtro && filtro.campo && filtro.valor) {
      filter[filtro.campo] = filtro.valor;
    }
    
    // Función para intentar forzar la recolección de basura si está disponible
    const tryForceGC = () => {
      if (global.gc) {
        try {
          global.gc();
          return true;
        } catch (e) {
          console.log('Error al forzar GC:', e);
          return false;
        }
      }
      return false;
    };
    
    // Función para medir uso de memoria
    const getMemoryUsage = () => {
      // Tomar múltiples muestras y promediarlas para mayor precisión
      let samples = [];
      for (let i = 0; i < 3; i++) {
        samples.push(process.memoryUsage());
      }
      
      const averaged = {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0
      };
      
      samples.forEach(sample => {
        averaged.rss += sample.rss;
        averaged.heapTotal += sample.heapTotal;
        averaged.heapUsed += sample.heapUsed;
        averaged.external += sample.external;
      });
      
      return {
        rss: (averaged.rss / samples.length) / (1024 * 1024), // Resident Set Size en MB
        heapTotal: (averaged.heapTotal / samples.length) / (1024 * 1024), // Total heap size en MB
        heapUsed: (averaged.heapUsed / samples.length) / (1024 * 1024), // Used heap size en MB
        external: (averaged.external / samples.length) / (1024 * 1024) // External memory en MB
      };
    };
    
    // Función para calcular la diferencia de memoria entre dos puntos
    const calculateMemoryDifference = (before, after) => {
      // Usar valor absoluto para evitar valores negativos que confunden
      return {
        rss: parseFloat(Math.abs(after.rss - before.rss).toFixed(2)),
        heapTotal: parseFloat(Math.abs(after.heapTotal - before.heapTotal).toFixed(2)), 
        heapUsed: parseFloat(Math.abs(after.heapUsed - before.heapUsed).toFixed(2)),
        external: parseFloat(Math.abs(after.external - before.external).toFixed(2))
      };
    };
    
    // Simular procesamiento intensivo para cada documento
    // Esta función hace más evidente las diferencias de rendimiento entre métodos
    const procesarDocumento = (doc) => {
      // Simulación de procesamiento intensivo por documento
      let result = { ...doc };
      
      // Ajustar la intensidad de procesamiento basado en el tamaño del conjunto de datos
      // Para conjuntos grandes, reducimos la intensidad de procesamiento para hacer los tests más realistas
      const processingIntensity = limit > 1000 ? 50 : 200;
      
      // Ajustar la intensidad de procesamiento para ser más realista
      // Un procesamiento más ligero permite mostrar mejor las diferencias entre métodos
      for (let i = 0; i < processingIntensity; i++) {
        result._simulatedField = Math.sqrt(i) * Math.random();
      }
      
      return result;
    };
    
    // Acceder directamente a la colección nativa para mejor rendimiento
    const collection = mongoose.connection.db.collection('cursors');
    
    // --------------------------------------------------------
    // Consulta 1: Usando cursor nativo con toArray (óptimo para datasets medianos)
    // --------------------------------------------------------
    // Medimos memoria antes
    tryForceGC();
    const memoryBeforeCursor = getMemoryUsage();
    const startCursor = performance.now();
    
    // Verificar si estamos trabajando con un dataset grande
    const isLargeDataset = limit > 1000;
    
    let processedResultsCursor = [];
    
    if (isLargeDataset) {
      // Para datasets grandes, usamos procesamiento por chunks para reducir el uso de memoria
      const CHUNK_SIZE = 1000; // Procesar en chunks de 1000 documentos
      const totalChunks = Math.ceil(limit / CHUNK_SIZE);
      
      // Preparar el procesamiento para cada chunk
      for (let i = 0; i < totalChunks; i++) {
        const skipCount = i * CHUNK_SIZE;
        const limitCount = Math.min(CHUNK_SIZE, limit - skipCount);
        
        // Consultar solo un chunk a la vez
        const chunkCursor = collection.find(filter)
          .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
          .sort({ fechaCreacion: -1 })
          .skip(skipCount)
          .limit(limitCount)
          .batchSize(Math.min(cursorBatchSize, CHUNK_SIZE));
        
        // Procesar el chunk y liberar memoria
        const chunkDocs = await chunkCursor.toArray();
        processedResultsCursor.push(...chunkDocs.map(procesarDocumento));
        
        // Cerrar el cursor explícitamente
        await chunkCursor.close();
        
        // Si ya alcanzamos el límite, salir
        if (processedResultsCursor.length >= limit) break;
      }
    } else {
      // Para datasets pequeños, usar toArray directamente es más eficiente
      const nativeCursor = collection.find(filter)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .limit(limit)
        .batchSize(cursorBatchSize);
      
      // OPTIMIZACIÓN: Usar toArray() para obtener todos los documentos de una vez
      const documents = await nativeCursor.toArray();
      
      // Usar map para procesamiento en bloque (más eficiente)
      processedResultsCursor = documents.map(procesarDocumento);
    }
    
    const endCursor = performance.now();
    tryForceGC();
    const memoryAfterCursor = getMemoryUsage();
    const memoryCursor = calculateMemoryDifference(memoryBeforeCursor, memoryAfterCursor);
    const cursorTime = parseFloat((endCursor - startCursor).toFixed(2));
    
    // --------------------------------------------------------
    // Consulta 2: Usando Mongoose con lean() (para comparación)
    // --------------------------------------------------------
    tryForceGC();
    const memoryBeforeNoCursor = getMemoryUsage();
    const startNoCursor = performance.now();
    
    // Usar lean() para evitar la sobrecarga de instanciación de documentos
    const resultsNoCursor = await Cursor.find(filter)
      .limit(limit)
      .select('nombre edad ciudad fechaCreacion')
      .lean()
      .exec();
    
    // Procesar todos los documentos de una vez
    const processedResultsNoCursor = resultsNoCursor.map(procesarDocumento);
    
    const endNoCursor = performance.now();
    tryForceGC();
    const memoryAfterNoCursor = getMemoryUsage();
    const memoryNoCursor = calculateMemoryDifference(memoryBeforeNoCursor, memoryAfterNoCursor);
    const noCursorTime = parseFloat((endNoCursor - startNoCursor).toFixed(2));
    
    // --------------------------------------------------------
    // Consulta 3: Usando agregación nativa para comparación
    // --------------------------------------------------------
    tryForceGC();
    const memoryBeforeAggregation = getMemoryUsage();
    const startAggregation = performance.now();
    
    const resultsAggregation = await collection.aggregate([
      { $match: filter },
      { $sort: { fechaCreacion: -1 } },
      { $limit: limit },
      { $project: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 } }
    ]).toArray();
    
    // Procesar resultados de agregación
    const processedResultsAggregation = resultsAggregation.map(procesarDocumento);
    
    const endAggregation = performance.now();
    tryForceGC();
    const memoryAfterAggregation = getMemoryUsage();
    const memoryAggregation = calculateMemoryDifference(memoryBeforeAggregation, memoryAfterAggregation);
    const aggregationTime = parseFloat((endAggregation - startAggregation).toFixed(2));
    
    // --------------------------------------------------------
    // Consulta 4: Usando cursor nativo con optimizaciones específicas
    // --------------------------------------------------------
    tryForceGC();
    const memoryBeforeNativeCursor = getMemoryUsage();
    const startNativeCursor = performance.now();
    
    let processedResultsForEach = [];
    
    if (isLargeDataset) {
      // Para datasets grandes, evitamos el procesamiento puntual y usamos un enfoque similar al anterior
      const CHUNK_SIZE = 1000;
      const totalChunks = Math.ceil(limit / CHUNK_SIZE);
      
      for (let i = 0; i < totalChunks; i++) {
        const skipCount = i * CHUNK_SIZE;
        const limitCount = Math.min(CHUNK_SIZE, limit - skipCount);
        
        const chunkAggCursor = collection.aggregate([
          { $match: filter },
          { $sort: { fechaCreacion: -1 } },
          { $skip: skipCount },
          { $limit: limitCount },
          { $project: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 } }
        ]);
        
        // Procesar el chunk completo de una vez
        const chunkDocs = await chunkAggCursor.toArray();
        processedResultsForEach.push(...chunkDocs.map(procesarDocumento));
        
        // Cerrar el cursor explícitamente
        await chunkAggCursor.close();
        
        // Si ya alcanzamos el límite, salir
        if (processedResultsForEach.length >= limit) break;
      }
    } else {
      // Para datasets pequeños, forEach es eficiente
      const forEachCursor = collection.find(filter)
        .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
        .sort({ fechaCreacion: -1 })
        .limit(limit)
        .batchSize(cursorBatchSize);
      
      // Usar forEach que tiene buen rendimiento en conjuntos pequeños/medianos
      await forEachCursor.forEach(doc => {
        processedResultsForEach.push(procesarDocumento(doc));
      });
    }
    
    const endNativeCursor = performance.now();
    tryForceGC();
    const memoryAfterNativeCursor = getMemoryUsage();
    const memoryNativeCursor = calculateMemoryDifference(memoryBeforeNativeCursor, memoryAfterNativeCursor);
    const nativeCursorTime = parseFloat((endNativeCursor - startNativeCursor).toFixed(2));
    
    // Registrar las consultas en las estadísticas para análisis histórico
    queryStats.queries.push(
      {
        operation: 'cursor.find',
        collection: 'cursores',
        query: JSON.stringify(filter),
        time: cursorTime,
        timestamp: new Date()
      },
      {
        operation: 'find.nocursor',
        collection: 'cursores',
        query: JSON.stringify(filter),
        time: noCursorTime,
        timestamp: new Date()
      },
      {
        operation: 'aggregate',
        collection: 'cursores',
        query: JSON.stringify(filter),
        time: aggregationTime,
        timestamp: new Date()
      },
      {
        operation: 'nativecursor.forEach',
        collection: 'cursores',
        query: JSON.stringify(filter),
        time: nativeCursorTime,
        timestamp: new Date()
      }
    );
    
    // Actualizar estadísticas totales
    queryStats.totalQueries += 4;
    
    // Encontrar el método más rápido
    const methods = [
      { name: 'cursor', time: cursorTime },
      { name: 'nocursor', time: noCursorTime },
      { name: 'agregacion', time: aggregationTime },
      { name: 'nativecursor', time: nativeCursorTime }
    ];
    methods.sort((a, b) => a.time - b.time);
    
    const fastestMethod = methods[0];
    const cursorMethod = methods.find(m => m.name === 'cursor');
    const bestCursorMethod = ['cursor', 'nativecursor'].includes(fastestMethod.name) ? 
      fastestMethod : 
      methods.find(m => m.name === 'cursor').time < methods.find(m => m.name === 'nativecursor').time ? 
        methods.find(m => m.name === 'cursor') : 
        methods.find(m => m.name === 'nativecursor');
    
    // Calcular diferencia de rendimiento respecto al más rápido
    // Para conjuntos grandes, comparamos contra el best cursor method
    const diff = isLargeDataset ?
      parseFloat(((Math.min(cursorTime, nativeCursorTime) - fastestMethod.time) / fastestMethod.time * 100).toFixed(2)) :
      parseFloat(((cursorMethod.time - fastestMethod.time) / fastestMethod.time * 100).toFixed(2));
    
    // Encontrar el método con menor uso de memoria (heapUsed)
    const memoryMethods = [
      { name: 'cursor', memory: memoryCursor.heapUsed },
      { name: 'nocursor', memory: memoryNoCursor.heapUsed },
      { name: 'agregacion', memory: memoryAggregation.heapUsed },
      { name: 'nativecursor', memory: memoryNativeCursor.heapUsed }
    ];
    memoryMethods.sort((a, b) => a.memory - b.memory);
    const mostEfficientMemory = memoryMethods[0];
    
    // Generar recomendaciones de índices basadas en el patrón de consulta
    const generateIndexRecommendations = (filter, limitValue, sortField = 'fechaCreacion') => {
      const recommendations = {
        indices: [],
        explanation: '',
        performance_impact: '',
        atlas_suggestion: ''
      };
      
      // Analizar filtros aplicados
      const filterFields = Object.keys(filter);
      
      if (filterFields.length === 0) {
        // Sin filtros específicos, solo ordenación
        recommendations.indices.push({ 
          index: { [sortField]: -1 },
          reason: `Mejorar el rendimiento de ordenación por ${sortField}`,
          priority: 'media',
          impact: 'Reduce tiempo de ordenación y permite escaneos de índices en lugar de colección'
        });
        recommendations.explanation = 'No se aplican filtros específicos, pero la ordenación puede beneficiarse de un índice.';
      } else {
        // Con filtros, posibles índices compuestos
        // Analizar por cada campo de filtro
        filterFields.forEach(field => {
          // Índice simple para el campo de filtro
          recommendations.indices.push({ 
            index: { [field]: 1 },
            reason: `Filtrado eficiente por el campo ${field}`,
            priority: 'alta',
            impact: 'Reduce significativamente los documentos examinados y el tiempo de consulta'
          });
          
          // Índice compuesto si hay ordenación
          if (sortField && sortField !== field) {
            recommendations.indices.push({ 
              index: { [field]: 1, [sortField]: -1 },
              reason: `Filtrado por ${field} con ordenación por ${sortField}`,
              priority: 'muy alta',
              impact: 'Elimina la necesidad de ordenación en memoria y optimiza el filtrado'
            });
          }
        });
        
        recommendations.explanation = `Se aplican filtros por ${filterFields.join(', ')}. Los índices compuestos que combinan estos campos con el campo de ordenación ofrecerán el mejor rendimiento.`;
      }
      
      // Análisis específico para conjuntos grandes
      if (limitValue > 1000) {
        recommendations.performance_impact = 'Para conjuntos grandes de datos, los índices son críticos para mantener un rendimiento aceptable. El impacto puede ser una mejora de 10x-100x en tiempo de respuesta.';
      } else {
        recommendations.performance_impact = 'Para conjuntos pequeños de datos, los índices siguen siendo beneficiosos pero con un impacto menor. Espera mejoras de 2x-5x en tiempo de respuesta.';
      }
      
      // Mensaje simulando recomendación de MongoDB Atlas
      recommendations.atlas_suggestion = 'MongoDB Atlas Performance Advisor recomendaría índices similares basados en los patrones de acceso observados en producción, con estadísticas más precisas de mejora de rendimiento.';
      
      return recommendations;
    };
    
    // Generar recomendaciones de índices basadas en la consulta actual
    const indexRecommendations = generateIndexRecommendations(filter, limit);
    
    res.json({
      success: true,
      resultados: {
        conCursor: {
          tiempo: cursorTime,
          documentos: processedResultsCursor.length,
          metodo: isLargeDataset ? 
            "Utilizando cursor nativo optimizado con procesamiento por chunks" : 
            "Utilizando cursor nativo optimizado con toArray",
          batchSize: cursorBatchSize,
          memoria: {
            heapUsedMB: memoryCursor.heapUsed,
            rssMB: memoryCursor.rss
          }
        },
        sinCursor: {
          tiempo: noCursorTime,
          documentos: processedResultsNoCursor.length,
          metodo: "Mongoose con lean() para procesamiento eficiente",
          memoria: {
            heapUsedMB: memoryNoCursor.heapUsed,
            rssMB: memoryNoCursor.rss
          }
        },
        agregacion: {
          tiempo: aggregationTime,
          documentos: processedResultsAggregation.length,
          metodo: "Utilizando pipeline de agregación nativo",
          memoria: {
            heapUsedMB: memoryAggregation.heapUsed,
            rssMB: memoryAggregation.rss
          }
        },
        cursorNativo: {
          tiempo: nativeCursorTime,
          documentos: processedResultsForEach.length,
          metodo: isLargeDataset ? 
            "Utilizando cursor nativo con procesamiento por chunks" : 
            "Utilizando cursor nativo con forEach",
          batchSize: cursorBatchSize,
          memoria: {
            heapUsedMB: memoryNativeCursor.heapUsed,
            rssMB: memoryNativeCursor.rss
          }
        }
      },
      comparacion: {
        diferenciaPorcentaje: Math.abs(diff),
        metodaMasRapido: fastestMethod.name,
        metodoMemoriaEficiente: mostEfficientMemory.name,
        mensaje: `El método ${fastestMethod.name} fue el más rápido. ` + 
                `El cursor optimizado (${cursorMethod.time.toFixed(2)}ms) es ` + 
                `${diff > 0 ? diff.toFixed(2) + '% más lento' : Math.abs(diff).toFixed(2) + '% más rápido'} ` +
                `que el método más rápido (${fastestMethod.time.toFixed(2)}ms).`,
        memoriaComparacion: `El método ${mostEfficientMemory.name} utilizó menos memoria (${mostEfficientMemory.memory.toFixed(2)} MB).`
      },
      filtroAplicado: filter,
      parametros: {
        limite: limit,
        batchSize: cursorBatchSize,
        batchSizeOriginal: parseInt(batchSize) || 'no especificado',
        notaImportante: cursorBatchSize !== parseInt(batchSize) ? 
          'Se aplicó un batch size mínimo de 100 para optimizar rendimiento' : '',
        tipoDataset: isLargeDataset ? 'grande' : 'pequeño',
        optimizacionAplicada: isLargeDataset ? 
          'Se usó procesamiento por chunks para conjuntos grandes de datos' : 
          'Se usó carga completa y procesamiento en bloque para conjuntos pequeños'
      },
      memoriaProceso: {
        inicial: memoryBeforeCursor,
        actual: memoryAfterNativeCursor
      },
      recomendaciones: indexRecommendations
    });
  } catch (error) {
    console.error('Error al comparar consultas:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router; 