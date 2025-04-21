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
    
    // Simulamos la creación de un cursor real de MongoDB
    // Normalmente, esto no ejecuta la consulta inmediatamente
    const mongoQuery = Cursor.find({ 
      ciudad: cursorExiste.ciudad
    });

    // Definimos un tamaño de lote (batch size) para simular cómo MongoDB
    // obtiene resultados en lotes para optimizar memoria y rendimiento
    mongoQuery.batchSize(5);
    
    // La consulta sólo se ejecuta cuando:
    // 1. Se llama a .exec()
    // 2. Se itera sobre el cursor (.forEach, for...of)
    // 3. Se convierte a array (.toArray())
    
    // Para obtener métricas como lo haría el driver de MongoDB
    let docsExamined = 0;
    let docsReturned = 0;
    let currentBatch = 1;
    let usedIndexes = false;
    
    // Ejecutamos la consulta (esto activaría el cursor en MongoDB)
    const cursorResultados = await mongoQuery.exec();
    
    // Simulamos estadísticas que el driver de MongoDB proporcionaría
    docsExamined = cursorResultados.length + Math.floor(Math.random() * 5); // Simula documentos escaneados
    docsReturned = cursorResultados.length;
    
    // Simulamos uso de índices basado en ciertos criterios
    usedIndexes = docsExamined <= docsReturned * 1.5; 
    
    const endTime = performance.now();
    const executionTime = parseFloat((endTime - startTime).toFixed(2));
    
    // En MongoDB real, estas estadísticas vendrían del comando explain()
    const stats = {
      executionTime: executionTime,
      docsExamined: docsExamined,
      docsReturned: docsReturned,
      indexUsed: usedIndexes,
      operationType: 'find',
      batchSize: 5,
      batches: currentBatch,
      // Simulamos información adicional del cursor
      cursorInfo: {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`, // Simulamos un ID de cursor
        ns: `CBDDatabase.cursores`,                               // Namespace (database.collection)
        query: JSON.stringify({ ciudad: cursorExiste.ciudad }),   // La consulta ejecutada
        limit: 0,                                                 // Sin límite aplicado
        skip: 0,                                                  // Sin salto aplicado
        batchSize: 5,                                             // Tamaño de lote
        maxTimeMS: 30000,                                         // Tiempo máximo de ejecución
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
          "Puede ser recorrido de forma iterativa para procesar documento por documento"
        ],
        methods: [
          "batchSize() - Define cuántos documentos se recuperan en cada lote",
          "limit() - Limita el número de documentos a devolver",
          "skip() - Omite un número específico de documentos",
          "sort() - Ordena los resultados por campos específicos"
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

module.exports = router; 