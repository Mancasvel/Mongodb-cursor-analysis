const express = require('express');
const router = express.Router();
const Cursor = require('../models/Cursor');
const { performance } = require('perf_hooks');
const mongoose = require('mongoose');
const { getQueryStats } = require('../middleware/performance');

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
    
    // Definimos un tamaño de lote optimizado para el cursor
    const batchSize = 20;
    
    // Acceder directamente a la colección para un rendimiento óptimo
    const collection = mongoose.connection.db.collection('cursors');
    
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
    
    // Utilizamos el patrón de cursor óptimo: iterar en batches
    while (await mongoCursor.hasNext()) {
      batch = await mongoCursor.next();
      cursorResultados.push(batch);
      docsReturned++;
      
      // Incrementamos el número de lotes procesados
      if (docsReturned % batchSize === 1) {
        currentBatch++;
      }
      
      // Limitamos a 100 documentos para la demostración
      if (docsReturned >= 100) break;
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
    
    // Procesar los documentos de manera eficiente con streaming
    const processedResultsCursor = [];
    
    // Usar for-await para iterar el cursor - esto es más eficiente que toArray()
    for await (const doc of nativeCursor) {
      processedResultsCursor.push(procesarDocumento(doc));
      
      // Si ya tenemos suficientes documentos, paramos
      if (processedResultsCursor.length >= limit) {
        break;
      }
    }
    
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
    
    // Procesar resultados con cursor de agregación
    const processedResultsAggCursor = [];
    for await (const doc of aggCursor) {
      processedResultsAggCursor.push(procesarDocumento(doc));
    }
    
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
        "Considera usar el cursor nativo para mayor rendimiento en conjuntos grandes"
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