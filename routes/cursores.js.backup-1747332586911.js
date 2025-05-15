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

// Listar todos los cursores (con paginación)
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

// Formulario para crear un nuevo cursor
router.get('/nuevo', (req, res) => {
  res.render('cursores/nuevo');
});

// Crear un nuevo cursor
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

// Formulario para editar un cursor existente
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

// Actualizar un cursor existente
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

// Eliminar un cursor
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
    const cursorExiste = await Cursor.findById(cursorId);
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
    const aggCursorTime = parseFloat((endAggCursor - startAggCursor).toFixed(2));
    
    // Registrar las consultas en las estadísticas para análisis histórico
    // Consulta con cursor
    queryStats.queries.push({
      operation: 'cursor.find',
      collection: 'cursores',
      query: JSON.stringify(filter),
      time: cursorTime,
      timestamp: new Date()
    });
    
    // Consulta sin cursor
    queryStats.queries.push({
      operation: 'find.nocursor',
      collection: 'cursores',
      query: JSON.stringify(filter),
      time: noCursorTime,
      timestamp: new Date()
    });
    
    // Consulta de agregación
    queryStats.queries.push({
      operation: 'aggregate',
      collection: 'cursores',
      query: JSON.stringify(filter),
      time: aggregationTime,
      timestamp: new Date()
    });
    
    // Consulta con cursor nativo
    queryStats.queries.push({
      operation: 'nativecursor.find',
      collection: 'cursores',
      query: JSON.stringify(filter),
      time: aggCursorTime,
      timestamp: new Date()
    });
    
    // Actualizar estadísticas totales
    queryStats.totalQueries += 4;
    
    // Calcular diferencia de rendimiento en porcentaje
    const diff = parseFloat(((noCursorTime - cursorTime) / noCursorTime * 100).toFixed(2));
    const isOptimizado = cursorTime < noCursorTime;
    
    res.json({
      success: true,
      resultados: {
        conCursor: {
          tiempo: cursorTime,
          documentos: processedResultsCursor.length,
          metodo: "Utilizando cursor nativo optimizado con procesamiento por lotes",
          batchSize: cursorBatchSize
        },
        sinCursor: {
          tiempo: noCursorTime,
          documentos: processedResultsNoCursor.length,
          metodo: "Recuperación y procesamiento en un solo lote"
        },
        agregacion: {
          tiempo: aggregationTime,
          documentos: processedResultsAggregation.length,
          metodo: "Utilizando pipeline de agregación"
        },
        cursorNativo: {
          tiempo: aggCursorTime,
          documentos: processedResultsAggCursor.length,
          metodo: "Utilizando cursor de agregación",
          batchSize: cursorBatchSize
        }
      },
      comparacion: {
        diferenciaPorcentaje: Math.abs(diff),
        metodaMasRapido: isOptimizado ? "cursor" : "nocursor",
        mensaje: isOptimizado 
          ? `El cursor fue ${Math.abs(diff)}% más rápido que la consulta directa` 
          : `La consulta directa fue ${Math.abs(diff)}% más rápida que el cursor`
      },
      filtroAplicado: filter,
      parametros: {
        limite: limit,
        batchSize: cursorBatchSize
      },
      recomendaciones: [
        "Utiliza `.lean()` para reducir el overhead de creación de objetos Mongoose",
        "Configura un tamaño de lote (batchSize) adecuado para tu caso de uso",
        "Utiliza proyección (select) para traer solo los campos necesarios",
        "Aprovecha los índices estableciendo ordenación en campos indexados",
        "Considera usar el cursor nativo para mayor rendimiento en conjuntos grandes",
        "Para conjuntos pequeños o medianos (<100K docs), procesa en bloque con .toArray() y .map()",
        "Para conjuntos realmente grandes (>1M docs), usa procesamiento por lotes con cursores y límites de memoria"
      ]
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